"use client";

declare global {
  interface Window {
    goHome?: () => void;
  }
}

export default function Header() {
  return (
    <>
      <header className="hdr">
        <div className="hdr-inner">
          <div>
            <div className="logo">
              Gut<span>guard</span>
            </div>
            <div className="logo-sub">IGI Corp | CVA Bldg, JP Laurel Ave, Davao City</div>
          </div>
          <div className="hdr-right">
            <button
              className="back-btn"
              id="backBtn"
              type="button"
              onClick={() => window.goHome?.()}
            >
              &#8592; Home
            </button>
            <div className="ref">
              Ref. OPS-032326-003 <div className="pill pill-r">Deadline: Apr 1, 2026</div>
            </div>
          </div>
        </div>
      </header>
      <div className="memo-strip">
        <div className="memo-strip-inner">
          <div className="mi">
            TO: <strong>All Members, 01s, Leaders, Depots &amp; City Stockists</strong>
          </div>
          <div className="mi">
            FROM: <strong>Office of Chairman &amp; CEO</strong>
          </div>
          <div className="mi">
            DATE: <strong>March 23, 2026</strong>
          </div>
          <div className="mi">
            EXECUTION: <strong>April 5 - July 5, 2026</strong>
          </div>
        </div>
      </div>
    </>
  );
}
