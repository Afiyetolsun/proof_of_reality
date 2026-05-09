import { Eyebrow } from "./Eyebrow";
import {
  architectureUrl,
  basescanUrl,
  ensAppParentUrl,
  ensParentName,
  githubUrl,
  trustModelUrl,
  viewerHome,
} from "../lib/viewer-link";

export function Footer() {
  return (
    <footer className="container-page rule-top border-[--color-rule] py-14">
      <div className="grid grid-cols-2 gap-y-10 md:grid-cols-12">
        <div className="col-span-2 md:col-span-4">
          <div className="text-mono text-[--color-signal]">proof of reality</div>
          <p className="mt-3 max-w-xs text-body-s text-[--color-ink-mute]">
            Web3 oracle for the physical world. ETHPrague 2026, SpaceComputer track.
          </p>
        </div>

        <FooterCol title="Project" links={[
          ["Architecture", architectureUrl, true],
          ["Trust model", trustModelUrl, true],
          ["GitHub", githubUrl, true],
        ]} />

        <FooterCol title="App" links={[
          ["Open the app", viewerHome, true],
          [`${ensParentName} on ENS`, ensAppParentUrl, true],
          ["Base Sepolia", basescanUrl, true],
        ]} />

        <FooterCol title="Built with" links={[
          ["SpaceComputer Orbitport", "https://docs.spacecomputer.io", true],
          ["Swarm", "https://www.ethswarm.org", true],
          ["Base", "https://base.org", true],
        ]} />
      </div>

      <div className="mt-14 flex flex-col-reverse items-start justify-between gap-4 border-t border-[--color-rule] pt-6 md:flex-row md:items-center">
        <span className="text-mono-s text-[--color-ink-mute]">
          © {new Date().getFullYear()} · proof of reality · hackathon scaffold
        </span>
        <span className="text-mono-s text-[--color-ink-mute]">
          v0.1 · base-sepolia · live
        </span>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<readonly [string, string, boolean]>;
}) {
  return (
    <div className="col-span-1 md:col-span-2">
      <Eyebrow>{title}</Eyebrow>
      <ul className="mt-4 space-y-2.5 text-body-s">
        {links.map(([label, href, external]) => (
          <li key={label}>
            <a
              href={href}
              {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
              className="text-[--color-ink] underline decoration-transparent underline-offset-4 transition-colors hover:decoration-[--color-signal] hover:text-[--color-signal]"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
