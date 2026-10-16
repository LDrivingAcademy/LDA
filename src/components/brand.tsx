import { LDA_WEB_LOGO } from "@/lib/brand-assets";

type BrandSize = "home" | "page";

export function Brand({
  size = "page"
}: {
  size?: BrandSize;
  href?: string;
  label?: string;
}) {
  return (
    <a
      href="/"
      className="lda-universal-logo inline-flex shrink-0 items-center justify-center overflow-visible rounded-sm focus-ring"
      aria-label="L Driving Academy home"
      data-logo-slot="lda-brand"
      data-logo-size={size}
    >
      <img
        src={LDA_WEB_LOGO.src}
        alt={LDA_WEB_LOGO.alt}
        width={LDA_WEB_LOGO.width}
        height={LDA_WEB_LOGO.height}
        decoding="async"
        className="block h-full w-full object-contain"
        data-logo-image="lda-brand"
      />
    </a>
  );
}
