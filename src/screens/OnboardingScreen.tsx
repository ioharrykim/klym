import { MotionSignature } from '../components/MotionSignature';
import { Chip, GradeChip, Icon, StatusPill } from '../components/UI';
import { tokens } from '../lib/tokens';
import type { MotionSignatureStyle } from '../types/klym';

export function OnboardingScreen({
  style,
  onContinue,
}: {
  style: MotionSignatureStyle;
  onContinue: () => void;
}) {
  return (
    <section className="screen onboarding-screen">
      <div className="onboarding-progress">
        <i />
        <i />
        <i />
      </div>
      <button className="skip-button" type="button" onClick={onContinue}>
        SKIP
      </button>
      <div className="onboarding-visual">
        <MotionSignature seed={101} style={style} animate showGrid ink={tokens.paper} />
        <div className="brand-lockup">
          <strong>KLYM</strong>
          <span>KEEP LINES, YOUR MOVE</span>
        </div>
      </div>
      <div className="onboarding-panel">
        <span>KLYM // 003</span>
        <h1>
          KEEP LINES,
          <br />
          YOUR MOVE.
        </h1>
        <p>Track projects, turn send video into a Motion Signature, and export a premium Send Card.</p>
        <div className="onboarding-mini-projects">
          <div>
            <GradeChip grade="V6" />
            <StatusPill status="projecting" />
            <b>CONCRETE TRAVERSE</b>
          </div>
          <div>
            <Chip color={tokens.ok}>SENT</Chip>
            <b>MOTION SIGNATURE READY</b>
          </div>
        </div>
        <button className="onboarding-cta" type="button" onClick={onContinue}>
          GET STARTED
          <Icon name="arrow-right" size={16} />
        </button>
      </div>
    </section>
  );
}
