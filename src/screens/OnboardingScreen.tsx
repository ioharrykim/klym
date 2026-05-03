import { MotionSignature } from '../components/MotionSignature';
import { Chip, GradeChip, Icon, StatusPill } from '../components/UI';
import { useI18n } from '../lib/i18n';
import { tokens } from '../lib/tokens';
import type { MotionSignatureStyle } from '../types/klym';

export function OnboardingScreen({
  style,
  onContinue,
}: {
  style: MotionSignatureStyle;
  onContinue: () => void;
}) {
  const { t } = useI18n();

  return (
    <section className="screen onboarding-screen">
      <div className="onboarding-progress">
        <i />
        <i />
        <i />
      </div>
      <button className="skip-button" type="button" onClick={onContinue}>
        {t('onboarding.skip')}
      </button>
      <div className="onboarding-visual">
        <MotionSignature seed={101} style={style} animate showGrid ink={tokens.paper} />
        <div className="brand-lockup">
          <strong>KLYM</strong>
          <span>{t('app.tagline')}</span>
        </div>
      </div>
      <div className="onboarding-panel">
        <span>{t('onboarding.kicker')}</span>
        <h1>{t('onboarding.title')}</h1>
        <p>{t('onboarding.body')}</p>
        <div className="onboarding-mini-projects">
          <div>
            <GradeChip grade="V6" />
            <StatusPill status="projecting" />
            <b>CONCRETE TRAVERSE</b>
          </div>
          <div>
            <Chip color={tokens.ok}>{t('common.sent')}</Chip>
            <b>{t('onboarding.ready')}</b>
          </div>
        </div>
        <button className="onboarding-cta" type="button" onClick={onContinue}>
          {t('onboarding.start')}
          <Icon name="arrow-right" size={16} />
        </button>
      </div>
    </section>
  );
}
