<!-- cc-team deliverable
 group: P4D (Phase 4.4 â€” Layout QA vs manus.im (3-column, header, responsive))
 member: P4D-5 role=dev model=deepseek/deepseek-v4-pro
 finish_reason: stop | tokens: {"prompt_tokens":72,"completion_tokens":1965,"total_tokens":2037,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"completion_tokens_details":{"reasoning_tokens":1742,"image_tokens":0},"cache_creation_input_tokens":0} | 35s
 generated: 2026-06-12T03:45:36.172Z -->
.pageContainer {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.leftSidebar {
  width: 280px;
  flex-shrink: 0;
  overflow-y: auto;
}

.centerChat {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.rightPanel {
  width: 360px;
  flex-shrink: 0;
  overflow-y: auto;
}

/* Tablet landscape / small desktop */
@media (max-width: 1200px) {
  .leftSidebar {
    width: 240px;
  }

  .rightPanel {
    width: 300px;
  }
}

/* Tablet portrait / mobile */
@media (max-width: 768px) {
  .pageContainer {
    flex-direction: column;
  }

  .leftSidebar {
    display: none;
  }

  .centerChat {
    flex: 1;
  }

  .rightPanel {
    width: 100%;
    max-height: 50vh;
  }
}
