/* "Install on your phone" card, shown only on phones that haven't installed the app yet. */
import { useState } from "react";
import { PiDownloadSimpleBold, PiExportBold, PiXBold } from "react-icons/pi";
import { dismissInstall, promptInstall, useInstallMode } from "../../lib/install.ts";
import { Button, IconButton } from "./Button.tsx";
import { BrandMark } from "./Brand.tsx";

export function InstallBanner({ text = "Open it like an app, straight from your home screen." }: { text?: string }) {
  const mode = useInstallMode();
  const [hidden, setHidden] = useState(false);
  if (!mode || hidden) return null;
  const close = () => {
    dismissInstall();
    setHidden(true);
  };
  return (
    <div className="card install enter" role="region" aria-label="Install the app">
      <BrandMark size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3>Install GymDesk</h3>
        {mode === "prompt" ? (
          <p className="muted" style={{ fontSize: 13 }}>
            {text}
          </p>
        ) : (
          <p className="muted" style={{ fontSize: 13 }}>
            Tap <PiExportBold aria-label="Share" style={{ verticalAlign: "-2px" }} /> Share, then <strong>Add to Home Screen</strong>.
          </p>
        )}
      </div>
      {mode === "prompt" && (
        <Button size="sm" variant="primary" icon={<PiDownloadSimpleBold />} onClick={() => void promptInstall().then((ok) => ok && setHidden(true))}>
          Install
        </Button>
      )}
      <IconButton label="Not now" icon={<PiXBold />} onClick={close} />
    </div>
  );
}
