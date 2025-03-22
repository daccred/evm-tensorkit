import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ProjectList from "@/components/ProjectList";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export default function Dashboard() {
  const { signOut } = useAuth();

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-background">
        <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold">Smart Contract Manager</h1>
            <Button
              onClick={() => {
                signOut();
              }}
              variant="outline"
            >
              Log Out
            </Button>
          </div>
          
          <ProjectList />
        </main>
      </div>
    </ProtectedRoute>
  );
}