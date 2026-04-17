"use client";

import { useGutguardActions } from "./GutguardActionContext";
import { gutguardSiteConfig } from "@/lib/gutguard-site-config";

export default function Header() {
  const { goHome } = useGutguardActions();

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
              onClick={goHome}
            >
              &#8592; Home
            </button>
            <div className="ref">
              {gutguardSiteConfig.referenceCode}{" "}
              <div className="pill pill-r">Deadline: {gutguardSiteConfig.deadlineLabel}</div>
            </div>
          </div>
        </div>
      </header>
      <div className="memo-strip">
        <div className="memo-strip-inner">
          <div className="mi">
            TO: <strong>{gutguardSiteConfig.memoTo}</strong>
          </div>
          <div className="mi">
            FROM: <strong>{gutguardSiteConfig.memoFrom}</strong>
          </div>
          <div className="mi">
            DATE: <strong>{gutguardSiteConfig.memoDate}</strong>
          </div>
          <div className="mi">
            EXECUTION: <strong>{gutguardSiteConfig.executionWindow}</strong>
          </div>
        </div>
      </div>
    </>
  );
}
