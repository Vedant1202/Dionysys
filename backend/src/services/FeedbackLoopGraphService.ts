import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type {
  FeedbackGraphRecommendation,
  FeedbackSentiment,
  IAppliedAdaptiveDecision,
  IFeedbackLoopMetrics,
} from '../db/IDatabaseAdapter.js';

export interface FeedbackLoopGraphInput {
  appliedDecision: IAppliedAdaptiveDecision;
  metrics: IFeedbackLoopMetrics;
  feedback?: {
    sentiment: FeedbackSentiment;
    comment?: string | undefined;
  } | undefined;
}

export interface FeedbackLoopGraphOutput {
  recommendation: FeedbackGraphRecommendation;
  rationale: string;
}

const FeedbackLoopAnnotation = Annotation.Root({
  input: Annotation<FeedbackLoopGraphInput>(),
  output: Annotation<FeedbackLoopGraphOutput | undefined>(),
});

export class FeedbackLoopGraphService {
  private readonly graph = new StateGraph(FeedbackLoopAnnotation)
    .addNode('recommend', async (state) => ({
      output: recommendFromSignals(state.input),
    }))
    .addEdge(START, 'recommend')
    .addEdge('recommend', END)
    .compile();

  async evaluate(input: FeedbackLoopGraphInput): Promise<FeedbackLoopGraphOutput> {
    const result = await this.graph.invoke({ input });
    return result.output ?? {
      recommendation: 'observe',
      rationale: 'No recommendation was produced by the feedback loop graph.',
    };
  }
}

export function recommendFromSignals(input: FeedbackLoopGraphInput): FeedbackLoopGraphOutput {
  const { metrics, feedback } = input;

  if (feedback?.sentiment === 'in_the_way') {
    return {
      recommendation: 'revert',
      rationale: 'The user explicitly reported that the adapted workspace got in their way.',
    };
  }

  if (feedback?.sentiment === 'helpful' && metrics.activityScore >= 0) {
    return {
      recommendation: 'keep',
      rationale: 'The user marked the adaptation helpful and activity did not regress.',
    };
  }

  if (metrics.hiddenToolClicks >= 2 && metrics.hiddenToolFrictionRate >= 0.5) {
    return {
      recommendation: 'revert',
      rationale: 'The user repeatedly selected tools hidden by the active persona.',
    };
  }

  if (metrics.activityScore > 0 && metrics.productiveActionsPerMinute >= 0.5) {
    return {
      recommendation: 'keep',
      rationale: 'Post-decision activity is productive and tool friction is low enough for the MVP threshold.',
    };
  }

  if (metrics.activityScore < 0 || metrics.hiddenToolClicks > 0) {
    return {
      recommendation: 'observe',
      rationale: 'Signals are mixed or weakly negative, so the MVP should observe rather than mutate UI automatically.',
    };
  }

  return {
    recommendation: 'observe',
    rationale: 'There is not enough post-decision evidence to recommend keeping or reverting the persona change.',
  };
}
