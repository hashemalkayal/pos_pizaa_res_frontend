import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./components/layout/mainLayout/MainLayout";
import Home from "./pages/dashbaord/Dashboard";
import Categories from "./pages/categories/Categories";
import Payments from "./pages/payment/Payments";
import CreateOrder from "./pages/createOrder/CreateOrder";
import { ThemeProvider } from "@material-tailwind/react";
import CategoriesAdd from "./pages/categories/CategoriesAdd/CategoriesAdd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PublicRoute from "./components/shared/PublicRoute";
import ProtectedRoute from "./components/shared/ProtectedRoute";
import Login from "./pages/Login";
import CategoriesEdit from "./pages/categories/CategoriesEdit/CategoriesEdit";
import { Slide, ToastContainer } from "react-toastify";
import Landing from "./pages/Landing";
import Finance from "./pages/finance/Finance";
import OrdersHistory from "./pages/ordersHistory/OrdersHistory";
import Menu from "./pages/Menu";

const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider>
      <ToastContainer
        autoClose={3000}
        position="top-right"
        transition={Slide}
      />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            <Route
              path="/landing"
              element={
                <PublicRoute>
                  <Landing />
                </PublicRoute>
              }
            />

            <Route
              path="/menu"
              element={
                <PublicRoute>
                  <Menu />
                </PublicRoute>
              }
            />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Home />} />
              <Route path="create-order" element={<CreateOrder />} />
              <Route path="categories" element={<Categories />} />
              <Route path="payments" element={<Payments />} />
              <Route
                path="categories/categories-add"
                element={<CategoriesAdd />}
              />
              <Route
                path="categories/categories-edit"
                element={<CategoriesEdit />}
              />

              <Route path="/finance" element={<Finance />} />

              <Route path="/orders-history" element={<OrdersHistory />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

//
export default App;
