import type { RepresentativeQuote as RepresentativeQuoteData } from "../_generated/knowledge-types";

interface RepresentativeQuoteProps {
  quote: RepresentativeQuoteData;
  sourceLabel: string;
  sourceHref?: string;
  compact?: boolean;
}

function quoteLabel(quote: RepresentativeQuoteData) {
  if (quote.displayLanguage === "zh-classical") return "古文原句";
  if (quote.displayLanguage === "zh-modern") return "中文原句";
  return quote.textStatus === "original" ? "英文原文" : "英文译文";
}

function verificationLabel(quote: RepresentativeQuoteData) {
  if (quote.verificationStatus === "primary-verified") return "原典已核";
  if (quote.verificationStatus === "source-attributed") return "可靠来源转引";
  if (quote.verificationStatus === "traditional-attribution") return "传统归属";
  return "归属有争议";
}

export default function RepresentativeQuote({ quote, sourceLabel, sourceHref, compact = false }: RepresentativeQuoteProps) {
  const language = quote.displayLanguage === "en" ? "en" : quote.displayLanguage === "zh-classical" ? "zh-Hant" : "zh-CN";
  const translationLabel = quote.displayLanguage === "en" ? "中文翻译" : "今译";

  return (
    <figure className={`representative-quote${compact ? " representative-quote--compact" : ""}`}>
      <div className="representative-quote__eyebrow">
        <span>代表引文</span>
        <span>{quoteLabel(quote)} · {verificationLabel(quote)}</span>
      </div>
      <blockquote lang={language}>{quote.text}</blockquote>
      {quote.chineseTranslation ? (
        <p className="representative-quote__translation"><strong>{translationLabel}：</strong>{quote.chineseTranslation}</p>
      ) : null}
      <figcaption>
        {sourceHref ? <a href={sourceHref} target="_blank" rel="noreferrer">{sourceLabel}</a> : <span>{sourceLabel}</span>}
        {quote.translator ? <small>英文译者：{quote.translator}</small> : null}
        {quote.translationNote ? <small>{quote.translationNote}</small> : null}
        {quote.attributionNote ? <small>来源说明：{quote.attributionNote}</small> : null}
      </figcaption>
      <p className="representative-quote__annotation"><strong>思想提示：</strong>{quote.annotation}</p>
    </figure>
  );
}
