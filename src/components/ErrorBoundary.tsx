import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Circle] render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h1 className="brand-mark">Circle</h1>
          <p>Something went wrong on this screen.</p>
          <p className="error-boundary__detail">{this.state.error.message}</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              this.setState({ error: null });
              window.location.assign("/");
            }}
          >
            Reload Circle
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
