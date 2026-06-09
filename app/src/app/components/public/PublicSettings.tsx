import { Navigate } from 'react-router';

export default function PublicSettings() {
  return <Navigate to="/public/profile?tab=notifications" replace />;
}
