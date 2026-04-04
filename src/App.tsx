import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NewsFeed from "./components/NewsFeed";
import ArticlePage from "./pages/ArticlePage";
import CategoriesPage from "./pages/CategoriesPage";
import Favorites from "./pages/Favorites";
import Settings from "./pages/Settings";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import RadioPage from "./pages/RadioPage";
import RadioAdmin from "./pages/RadioAdmin";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";

const queryClient = new QueryClient();

const ThemeInit = () => {
  useEffect(() => {
    if (localStorage.getItem("eram_theme") === "light") {
      document.documentElement.classList.add("light");
    }
  }, []);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeInit />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<NewsFeed />} />
          <Route path="/article/:id" element={<ArticlePage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin-dashboard-ERAM-SECURE/login" element={<AdminLogin />} />
          <Route path="/admin-dashboard-ERAM-SECURE" element={<AdminDashboard />} />
          <Route path="/radio" element={<RadioPage />} />
          <Route path="/radio/admin" element={<RadioAdmin />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
