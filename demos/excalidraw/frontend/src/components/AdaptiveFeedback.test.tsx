import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdaptiveFeedback } from '@dionysys/react';

describe('AdaptiveFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Placement A toast when pendingRevert is true', () => {
    const handleKeep = vi.fn();
    const handleRevertClick = vi.fn();

    render(
      <AdaptiveFeedback
        onSubmit={vi.fn()}
        pendingRevert={true}
        onKeep={handleKeep}
        onRevertClick={handleRevertClick}
        title="Dionysys simplified the toolbar for Focus."
      />
    );

    expect(screen.getByText('Dionysys simplified the toolbar for Focus.')).toBeInTheDocument();
    
    // Check buttons
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revert' })).toBeInTheDocument();
  });

  it('calls onKeep and onSubmit("helpful") when Keep is clicked', () => {
    const handleKeep = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <AdaptiveFeedback
        onSubmit={handleSubmit}
        pendingRevert={true}
        onKeep={handleKeep}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    
    expect(handleKeep).toHaveBeenCalled();
    expect(handleSubmit).toHaveBeenCalledWith({ sentiment: 'helpful' });
  });

  it('morphs into Placement C survey when Revert is clicked', () => {
    const handleRevertClick = vi.fn();
    const handleSubmit = vi.fn();

    render(
      <AdaptiveFeedback
        onSubmit={handleSubmit}
        pendingRevert={true}
        onRevertClick={handleRevertClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    
    expect(handleRevertClick).toHaveBeenCalled();
    expect(screen.getByText('Layout Reverted')).toBeInTheDocument();
    expect(screen.getByText('Help Dionysys learn. What went wrong?')).toBeInTheDocument();
    expect(screen.queryByText('Dionysys simplified the toolbar for Focus.')).not.toBeInTheDocument();
  });

  it('submits detailed feedback from the survey', () => {
    const handleSubmit = vi.fn();

    render(
      <AdaptiveFeedback
        onSubmit={handleSubmit}
        pendingRevert={true}
      />
    );

    // Click Revert to show survey
    fireEvent.click(screen.getByRole('button', { name: 'Revert' }));
    
    // Click a survey option
    fireEvent.click(screen.getByRole('button', { name: 'I needed a hidden tool' }));

    expect(handleSubmit).toHaveBeenCalledWith({ sentiment: 'in_the_way', comment: 'Needed a hidden tool' });
  });

  it('renders calibration note when showCalibrationNote is true', () => {
    render(
      <AdaptiveFeedback
        onSubmit={vi.fn()}
        showCalibrationNote={true}
      />
    );

    expect(screen.getByText('Thanks! Your feedback helps us improve.')).toBeInTheDocument();
  });
});
