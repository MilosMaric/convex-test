import { useState } from 'react';
import TaskList, { SortType } from '@/components/TaskList';

export default function IncompleteTasksScreen() {
  const [sort, setSort] = useState<SortType>('latest');
  return <TaskList filter="incomplete" sort={sort} onSortChange={setSort} />;
}

