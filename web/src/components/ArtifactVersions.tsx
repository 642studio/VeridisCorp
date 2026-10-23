import { useState } from 'react';
import { diffWords } from 'diff';
import type { ArtifactRow } from '../api/types';

const STATUS_LABEL: Record<ArtifactRow['data']['status'], string> = {
  in_review: 'en revisión', approved: 'aprobada', superseded: 'sustituida', delivered: 'entregada',
};

function WordDiff({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <p className="artifact-diff">
      {parts.map((part, index) => (
        <span key={index} className={part.added ? 'artifact-diff__added' : part.removed ? 'artifact-diff__removed' : undefined}>
          {part.value}
        </span>
      ))}
    </p>
  );
}

export function ArtifactVersions({ artifacts }: { artifacts: ArtifactRow[] }) {
  const [openVersion, setOpenVersion] = useState<number | null>(artifacts.at(-1)?.version ?? null);
  const sorted = [...artifacts].sort((a, b) => a.version - b.version);

  return (
    <div className="artifact-versions">
      <h3>Versiones del artefacto</h3>
      {sorted.length === 0 && <p className="muted">Todavía no hay contenido generado.</p>}
      {sorted.map((artifact) => {
        const previous = sorted.find((a) => a.version === artifact.version - 1);
        const isOpen = openVersion === artifact.version;
        return (
          <div key={artifact.version} className="artifact-versions__item">
            <button type="button" className="artifact-versions__toggle" onClick={() => setOpenVersion(isOpen ? null : artifact.version)}>
              v{artifact.version} — {STATUS_LABEL[artifact.data.status]} {isOpen ? '▾' : '▸'}
            </button>
            {isOpen && (
              <div className="artifact-versions__body">
                <pre className="artifact-text">{artifact.content}</pre>
                <p className="muted">hash: {artifact.content_hash}</p>
                {previous && (
                  <>
                    <p className="muted">Cambios respecto a v{previous.version}:</p>
                    <WordDiff before={previous.content} after={artifact.content} />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
