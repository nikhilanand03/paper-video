import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import Processing from "./pages/Processing";
import Viewer from "./pages/Viewer";
import Library from "./pages/Library";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/video/:jobId",
    Component: Processing,
  },
  {
    path: "/v/:videoId",
    Component: Viewer,
  },
  {
    path: "/library",
    Component: Library,
  },
]);
