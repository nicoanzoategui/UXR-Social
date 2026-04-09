"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

interface TrendsChartProps {
  data: { date: string; network: string; count: number }[];
}

const NETWORK_COLORS: { [key: string]: { border: string; bg: string } } = {
  'Instagram': { border: '#EC4899', bg: 'rgba(236, 72, 153, 0.1)' },
  'Facebook': { border: '#3B82F6', bg: 'rgba(59, 130, 246, 0.1)' },
  'LinkedIn': { border: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.1)' },
  'X': { border: '#64748B', bg: 'rgba(100, 116, 139, 0.1)' },
};

export default function TrendsChart({ data }: TrendsChartProps) {
  // 1. Extract unique sorted dates for labels
  const allLabels = Array.from(new Set(data.map(d => d.date))).sort();
  
  // 2. Identify all unique networks in the data
  const networks = Array.from(new Set(data.map(d => d.network)));

  // 3. Create datasets for each network
  const datasets = networks.map(net => {
    const config = NETWORK_COLORS[net] || { border: '#cbd5e1', bg: 'rgba(203, 213, 225, 0.1)' };
    
    // Fill in data for each date, defaulting to 0 if missing for that date
    const networkData = allLabels.map(label => {
      const entry = data.find(d => d.date === label && d.network === net);
      return entry ? entry.count : 0;
    });

    return {
      fill: true,
      label: net,
      data: networkData,
      borderColor: config.border,
      backgroundColor: config.bg,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 3,
    };
  });

  const chartData = {
    labels: allLabels,
    datasets: datasets.length > 0 ? datasets : [
      {
        fill: true,
        label: 'Sin datos',
        data: allLabels.map(() => 0),
        borderColor: '#e2e8f0',
        backgroundColor: 'rgba(226, 232, 240, 0.1)',
        tension: 0.4,
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          padding: 20,
          font: {
            size: 11,
            weight: 'bold' as any,
          },
          color: '#64748b',
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#94a3b8',
        bodyColor: '#fff',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 12,
        displayColors: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(226, 232, 240, 0.5)',
        },
        ticks: {
          color: '#64748b',
          precision: 0,
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#64748b',
          maxRotation: 45,
          minRotation: 45,
        },
      },
    },
  };

  return (
    <div className="h-full w-full min-h-[300px]">
      <Line options={options} data={chartData} />
    </div>
  );
}
