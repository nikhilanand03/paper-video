import { Outlet } from "react-router";
import JobBanner from "./JobBanner";

export default function Layout() {
  return (
    <>
      <Outlet />
      <JobBanner />
    </>
  );
}
