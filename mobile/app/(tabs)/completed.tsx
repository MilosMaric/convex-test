import { useState } from 'react';
import TaskList, { SortType } from '@/components/TaskList';

export default function CompletedTasksScreen() {
  const [sort, setSort] = useState<SortType>('latest');
  return <TaskList filter="completed" sort={sort} onSortChange={setSort} />;
}

