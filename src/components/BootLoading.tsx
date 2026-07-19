type Props = {
  detail?: string;
};

/** Bridge between cinematic intro and the demo director */
export function BootLoading({ detail = "Preparing confidential demo…" }: Props) {
  return (
    <div className="boot-loading" role="status" aria-live="polite">
      <div className="boot-loading__orb" aria-hidden />
      <img src="/glyph.png" alt="" className="boot-loading__glyph" />
      <p className="atelier-kicker">Midnight · confidential</p>
      <strong className="brand-mark">Circle</strong>
      <p>{detail}</p>
      <div className="boot-loading__bar" aria-hidden>
        <span />
      </div>
    </div>
  );
}
