import type { Metadata } from "next";
import DashboardPage from "../dashboard/page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Learner Dashboard | L Driving Academy",
  description: "Secure L Driving Academy learner dashboard for signed-in accounts.",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

type DashboardRouteProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default function LearnerDashboardPage(props: DashboardRouteProps) {
  return <DashboardPage {...props} forcedRole="learner" />;
}
