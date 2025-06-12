'use client';

import React, { useState, useEffect } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { dashboardSupabase } from '@/lib/supabase';
import { CalendarIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface TemplateData {
  date: string;
  count: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          {payload[0].value} {payload[0].value === 1 ? 'Template' : 'Templates'}
        </p>
      </div>
    );
  }
  return null;
};

export default function TemplateTrends() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [data, setData] = useState<TemplateData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTemplateData() {
      if (!date?.from || !date?.to) return;

      try {
        const { data: templates, error } = await dashboardSupabase
          .from('templates')
          .select('created_at')
          .gte('created_at', startOfDay(date.from).toISOString())
          .lte('created_at', endOfDay(date.to).toISOString())
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Group templates by date and count them
        const templatesByDate = templates?.reduce((acc: { [key: string]: number }, template) => {
          const date = format(new Date(template.created_at), 'yyyy-MM-dd');
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});

        // Convert to array format for chart
        const chartData = Object.entries(templatesByDate || {}).map(([date, count]) => ({
          date: format(new Date(date), 'MMM dd'),
          count,
        }));

        setData(chartData);
      } catch (err) {
        console.error('Error fetching template data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTemplateData();
  }, [date]);

  return (
    <div className="w-full p-6 bg-white rounded-lg shadow dark:bg-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Template Creation Trends</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex justify-center items-center h-[400px] text-gray-500 dark:text-gray-400">
          No templates found in selected date range
        </div>
      ) : (
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
              barSize={32}
            >
              <XAxis
                dataKey="date"
                tick={{ fill: '#6B7280', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#E5E7EB' }}
              />
              <YAxis
                tick={{ fill: '#6B7280', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => Math.floor(value) === value ? value.toString() : ''}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
              />
              <Bar
                dataKey="count"
                fill="#3B82F6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
} 