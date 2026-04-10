import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import Processing from "./pages/Processing";
import Viewer from "./pages/Viewer";
import Library from "./pages/Library";
import Layout from "./components/Layout";

export const router = createBrowserRouter([
  {
    Component: Layout,
    children: [
      { path: "/", Component: Home },
      { path: "/video/:jobId", Component: Processing },
      { path: "/v/:videoId", Component: Viewer },
      { path: "/abs/:arxivId", Component: Viewer },
      { path: "/library", Component: Library },
    ],
  },
]);
