import { useState } from 'react';

function MessageBubble({ mine, text, lang, originalText, originalLang }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const hasTranslation = !mine && originalText && originalText !== text;

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-md rounded-lg px-4 py-2 border ${
          mine
            ? 'bg-sky-soft/20 border-sky-soft'
            : 'bg-surface border-border'
        }`}
      >
        <div className="flex items-start gap-2">
          <p className="text-text">{text}</p>
          <span className="text-[10px] font-medium text-sky-strong bg-sky-soft px-1.5 py-0.5 rounded shrink-0">
            {lang?.toUpperCase()}
          </span>
        </div>

        {hasTranslation && (
          <button
            onClick={() => setShowOriginal((v) => !v)}
            className="text-xs text-text-muted mt-1 underline decoration-dotted"
          >
            {showOriginal ? 'Masquer le texte original' : 'Voir le texte original'}
          </button>
        )}

        {hasTranslation && showOriginal && (
          <p className="text-sm text-text-muted italic mt-1">
            {originalText} <span className="not-italic">({originalLang?.toUpperCase()})</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;