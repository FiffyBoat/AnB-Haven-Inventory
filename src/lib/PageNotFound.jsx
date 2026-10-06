import { Link } from "react-router-dom";

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="text-center space-y-4">
        <h1 className="text-7xl font-light text-slate-300">404</h1>
        <h2 className="text-2xl font-medium text-slate-800">Page not found</h2>
        <Link to="/" className="inline-flex px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg">Go home</Link>
      </div>
    </div>
  );
}
