/**
 * <model-viewer> custom element type augmentation.
 *
 * Google's model-viewer ships as a web component; it doesn't export
 * React types. React 19 reads JSX intrinsics from the React.JSX
 * namespace, so we augment that to allow <model-viewer> with arbitrary
 * attrs in TSX.
 */
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": DetailedHTMLProps<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        HTMLAttributes<HTMLElement> & Record<string, any>,
        HTMLElement
      >;
    }
  }
}

export {};
