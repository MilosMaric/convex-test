import "./App.css";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function App() {
  const tasks = useQuery(api.tasks.get);
  const completedCount = useQuery(api.tasks.completedCount);
  const toggleCompleted = useMutation(api.tasks.toggleCompleted);

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-neutral-800 py-12 px-4">
      <div className="mb-8 text-white text-lg font-semibold">
        Completed tasks count: {completedCount ?? 0}
      </div>
      <div className="flex flex-wrap gap-8 justify-center items-center w-full">
        {tasks?.map(({ _id, text, isCompleted }) => (
          <Card
            key={_id}
            onClick={() => toggleCompleted({ id: _id })}
            className={`flex flex-col justify-between w-72 rounded-2xl shadow-lg p-4 border-2 border-neutral-700 ${isCompleted ? "bg-green-600" : "bg-neutral-700"} cursor-pointer transition-transform hover:scale-105 hover:ring-4 hover:ring-green-300/40`}
          >
            <CardHeader className="p-0 mb-2">
              <CardTitle className="truncate text-xl font-bold text-white mb-1">
                {text}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-base font-medium text-white/80">
                Status: {isCompleted ? "Completed" : "Incomplete"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default App;

