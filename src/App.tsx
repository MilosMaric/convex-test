import "./App.css";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const PAGE_SIZE = 9;

function App() {
  const [page, setPage] = useState(0);
  const tasks = useQuery(api.tasks.get, { page, pageSize: PAGE_SIZE });
  const totalCount = useQuery(api.tasks.totalCount);
  const completedCount = useQuery(api.tasks.completedCount);
  const completedCountOnPage = useQuery(api.tasks.completedCountOnPage, { page, pageSize: PAGE_SIZE });
  const toggleCompleted = useMutation(api.tasks.toggleCompleted);
  const toggleAll = useMutation(api.tasks.toggleAll);
  const setAllCompleted = useMutation(api.tasks.setAllCompleted);

  const totalPages = totalCount ? Math.ceil(totalCount / PAGE_SIZE) : 0;
  const canGoLeft = page > 0;
  const canGoRight = page < totalPages - 1;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!tasks) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && tasks[num - 1]) {
        toggleCompleted({ id: tasks[num - 1]._id });
      }
      if (e.key === 't') {
        toggleAll({ ids: tasks.map(t => t._id) });
      }
      if (e.key === 'c') {
        setAllCompleted({ ids: tasks.map(t => t._id), value: true });
      }
      if (e.key === 'u') {
        setAllCompleted({ ids: tasks.map(t => t._id), value: false });
      }
      if (e.key === 'ArrowLeft' && canGoLeft) {
        setPage(p => Math.max(0, p - 1));
      }
      if (e.key === 'ArrowRight' && canGoRight) {
        setPage(p => p + 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tasks, toggleCompleted, toggleAll, setAllCompleted, canGoLeft, canGoRight]);

  // Fill up to 9 slots with empty placeholders if needed
  const gridTasks = tasks ? [...tasks, ...Array(PAGE_SIZE - tasks.length).fill(null)] : Array(PAGE_SIZE).fill(null);

  // Check if buttons should be disabled
  const hasIncompleteTasksOnPage = tasks?.some(task => !task.isCompleted) ?? false;
  const hasCompletedTasksOnPage = tasks?.some(task => task.isCompleted) ?? false;

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-neutral-800 py-12 px-4">
      <div className="w-4/5 mx-auto flex flex-col items-center">
        <div className="mb-8 text-white text-lg font-semibold text-center">
          <div className="mb-2">
            Total completed tasks: {completedCount ?? 0}
          </div>
          <div>
            Completed tasks on page: {completedCountOnPage ?? 0}
          </div>
        </div>
        <div className="flex flex-row gap-4 mb-8">
          <Button onClick={() => toggleAll({ ids: tasks?.map(t => t._id) ?? [] })} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">Toggle all</Button>
          <Button 
            onClick={() => setAllCompleted({ ids: tasks?.map(t => t._id) ?? [], value: true })} 
            disabled={!hasIncompleteTasksOnPage}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Complete all
          </Button>
          <Button 
            onClick={() => setAllCompleted({ ids: tasks?.map(t => t._id) ?? [], value: false })} 
            disabled={!hasCompletedTasksOnPage}
            className="bg-neutral-700 hover:bg-neutral-800 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Uncomplete all
          </Button>
        </div>
        <div className="flex flex-row items-center gap-12 w-full justify-center">
          <Button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={!canGoLeft} className="text-3xl px-4 py-8 bg-transparent text-white disabled:opacity-30">&#8592;</Button>
          <div className="grid grid-cols-3 grid-rows-3 gap-x-2 gap-y-5 w-[1500px] min-h-[450px]">
            {gridTasks.map((task, i) =>
              task ? (
                <Card
                  key={task._id}
                  onClick={() => toggleCompleted({ id: task._id })}
                  className={`flex flex-col justify-between w-52 h-40 rounded-2xl shadow-lg p-4 border-2 border-neutral-700 ${task.isCompleted ? "bg-green-600" : "bg-neutral-700"} cursor-pointer transition-transform hover:scale-105 hover:ring-4 hover:ring-green-300/40`}
                >
                  <CardHeader className="p-0 mb-2">
                    <CardTitle className="text-base font-bold text-white mb-1 leading-tight">
                      {task.text}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="text-base font-medium text-white/80">
                      Status: {task.isCompleted ? "Completed" : "Incomplete"}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div key={i} className="w-52 h-40 rounded-2xl bg-neutral-700 opacity-30 border-2 border-neutral-700" />
              )
            )}
          </div>
          <Button onClick={() => setPage(p => p + 1)} disabled={!canGoRight} className="text-3xl px-4 py-8 bg-transparent text-white disabled:opacity-30">&#8594;</Button>
        </div>
      </div>
    </div>
  );
}

export default App;

