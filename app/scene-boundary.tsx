import { Component, type ReactNode } from "react";

/** Catch asynchronous scene-module failures while keeping the explorer controls mounted. */
export class SceneBoundary extends Component<
  { children: ReactNode; onError: (message: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError("无法启动三维查看器。请检查网络连接后重试。");
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
