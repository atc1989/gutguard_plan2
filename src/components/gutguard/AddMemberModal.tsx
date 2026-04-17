"use client";

function dispatchModalAction(type: "close" | "save") {
  if (typeof document === "undefined") {
    return;
  }

  document.dispatchEvent(
    new CustomEvent("gutguard:modal-action", {
      detail: { type }
    })
  );
}

export default function AddMemberModal() {
  return (
    <div className="modal-overlay" id="modal">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-hdr">
          <div className="modal-title" id="modal-title">
            Add Member
          </div>
          <button
            className="modal-close"
            type="button"
            onClick={() => dispatchModalAction("close")}
            aria-label="Close dialog"
          >
            &#10005;
          </button>
        </div>
        <div className="modal-body">
          <div className="fg">
            <div className="f">
              <label htmlFor="m-inp-name">Name</label>
              <input type="text" id="m-inp-name" placeholder="Full name" />
            </div>
            <div className="f">
              <label htmlFor="m-inp-pi">90-Day Pay-in Target</label>
              <input type="number" id="m-inp-pi" min="0" placeholder="0" />
            </div>
            <div className="f">
              <label htmlFor="m-inp-sales">90-Day Sales Target (PHP)</label>
              <input type="number" id="m-inp-sales" min="0" placeholder="0" />
            </div>
            <div className="f">
              <label htmlFor="m-inp-leads">90-Day Leads Target</label>
              <input type="number" id="m-inp-leads" min="0" placeholder="0" />
            </div>
            <div className="f">
              <label htmlFor="m-inp-att">90-Day Attendees Target</label>
              <input type="number" id="m-inp-att" min="0" placeholder="0" />
            </div>
            <div className="f">
              <label htmlFor="m-inp-evt">Big Event Attendees Committed</label>
              <input type="number" id="m-inp-evt" min="0" placeholder="0" />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn bto" type="button" onClick={() => dispatchModalAction("close")}>
            Cancel
          </button>
          <button className="btn btp" type="button" onClick={() => dispatchModalAction("save")}>
            Add to Consolidation
          </button>
        </div>
      </div>
    </div>
  );
}
