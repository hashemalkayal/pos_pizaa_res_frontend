import { useState, type FC } from "react";
import {
  Card,
  CardBody,
  Input,
  Typography,
  Button,
} from "@material-tailwind/react";
import { useMutationWithAxios } from "../api/hooks";
import { toast } from "react-toastify";
import Logo from "../assets/logo.png";
import { useNavigate } from "react-router-dom";
import LoaderOverlay from "@/components/shared/LoaderOverlay";
import { jwtDecode } from "jwt-decode";

const Login: FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const nav = useNavigate();

  const { mutateAsync, isPending } = useMutationWithAxios("auth", "login");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email.");
      return;
    }

    setError("");

    await mutateAsync(
      { email: email, password: password },
      {
        onSuccess: (res) => {
          const decoded = jwtDecode<any>(res.data.response.accessToken);
          localStorage.setItem("token", res.data.response.accessToken);
          localStorage.setItem("role", decoded.role);

          toast.success(res.data.message);

          nav("/", { replace: true });
        },
      }
    );
  };

  return (
    <>
      <LoaderOverlay show={isPending} />
      <div className="min-h-screen flex items-center justify-center bg-[#231f20] px-4">
        <Card className="w-full max-w-md shadow-xl rounded-xl border border-gray-100">
          <CardBody className="p-8 space-y-6 bg-white rounded-xl">
            <div className="flex justify-center">
              <img src={Logo} alt="logo" className="object-contain" />
            </div>

            <Typography
              variant="h4"
              className="text-center font-bold text-[#231f20]"
            >
              POS Login
            </Typography>

            {error && (
              <Typography variant="small" className="text-red-600 text-center">
                {error}
              </Typography>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl outline-none"
              />
              <Input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl outline-none"
              />

              <Button
                loading={isPending}
                disabled={isPending}
                type="submit"
                fullWidth
                className="mt-4 bg-[#f7ca27] text-[#231f20] font-semibold hover:shadow-lg shadow transition"
              >
                Sign In
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
};

export default Login;
