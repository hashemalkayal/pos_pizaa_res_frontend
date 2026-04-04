import { Navigate } from "react-router-dom";

type Props = {
  children: JSX.Element;
};

const PublicRoute = ({ children }: Props) => {
  const token = localStorage.getItem("token");

  if (token) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default PublicRoute;
