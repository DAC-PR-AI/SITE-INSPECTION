import InspectionApp from "../components/InspectionApp";
import ErrorBoundary from "../components/ErrorBoundary";

export default function Page() {
  return (
    <ErrorBoundary>
      <InspectionApp />
    </ErrorBoundary>
  );
}
