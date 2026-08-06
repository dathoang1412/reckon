import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, any uncaught render-time error (e.g. a Groq JSON response
// missing a field the UI assumed would always be there) unmounts the whole
// tree and leaves a blank white window with no indication anything went
// wrong — especially bad for the popup, which has no devtools access to
// check. Catches render errors and shows something instead of nothing.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", fontSize: 13, color: "#cf1322" }}>
          Đã có lỗi xảy ra: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}
