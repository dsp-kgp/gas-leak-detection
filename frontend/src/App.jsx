import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// --- Main Dashboard Component ---
function App() {
  const [data, setData] = useState([]);
  const [error, setError] = useState('');

  const API_URL = 'http://127.0.0.1:8000';

  // --- Data Fetching Function ---
  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/fetchall`);
      // The API returns data with the newest first, so we reverse it for chronological charting
      const formattedData = response.data.reverse().map(item => ({
        ...item,
        // Format timestamp for better readability on the chart's X-axis
        timestamp: new Date(item.timestamp).toLocaleTimeString(),
      }));
      setData(formattedData);
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to connect to the backend. Is the FastAPI server running?");
    }
  };

  // --- Effects to Fetch Data ---
  // 1. Fetch data when the component first mounts
  useEffect(() => {
    fetchData();
  }, []);

  // 2. Set up polling to fetch data every 5 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 5000); // 5000 milliseconds = 5 seconds

    // Cleanup function: clear the interval when the component unmounts
    return () => clearInterval(interval);
  }, []);


  // --- Render UI ---
  return (
    <div className="bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* --- Header --- */}
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400">IoT Sensor Dashboard</h1>
          <p className="text-gray-400 mt-2">Visualizing real-time sensor data from FastAPI</p>
        </header>

        {/* --- Error Message Display --- */}
        {error && (
          <div className="bg-red-800 border border-red-600 text-white px-4 py-3 rounded-lg relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* --- Charts Grid --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chart Card: Mean Value */}
          <ChartCard title="Mean Value">
            <DataChart data={data} dataKey="mean" strokeColor="#34d399" />
          </ChartCard>

          {/* Chart Card: Standard Deviation */}
          <ChartCard title="Standard Deviation">
            <DataChart data={data} dataKey="stddev" strokeColor="#fbbf24" />
          </ChartCard>

          {/* Chart Card: Slope */}
          <ChartCard title="Slope">
            <DataChart data={data} dataKey="slope" strokeColor="#f87171" />
          </ChartCard>

          {/* Chart Card: Raw Value */}
          <ChartCard title="Raw Value">
            <DataChart data={data} dataKey="raw" strokeColor="#60a5fa" />
          </ChartCard>
        </div>

        {/* --- Data Table --- */}
        <div className="mt-12 bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-cyan-300">Latest Readings</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Raw</th>
                  <th className="p-3">Mean</th>
                  <th className="p-3">Std Dev</th>
                  <th className="p-3">Slope</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().slice(0, 10).map((item) => (
                  <tr key={item.id} className="border-b border-gray-700 hover:bg-gray-700">
                    <td className="p-3">{item.timestamp}</td>
                    <td className="p-3">{item.raw}</td>
                    <td className="p-3">{item.mean.toFixed(2)}</td>
                    <td className="p-3">{item.stddev.toFixed(2)}</td>
                    <td className="p-3">{item.slope.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}


// --- Reusable Chart Card Component ---
const ChartCard = ({ title, children }) => (
  <div className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg">
    <h2 className="text-xl font-semibold mb-4 text-center">{title}</h2>
    <div className="w-full h-64 sm:h-72">
      {children}
    </div>
  </div>
);


// --- Reusable Data Chart Component ---
const DataChart = ({ data, dataKey, strokeColor }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart
      data={data}
      margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
      <XAxis dataKey="timestamp" stroke="#a0aec0" />
      <YAxis stroke="#a0aec0" />
      <Tooltip
        contentStyle={{ backgroundColor: '#1a202c', border: '1px solid #4a5568' }}
        labelStyle={{ color: '#cbd5e0' }}
      />
      <Legend />
      <Line type="monotone" dataKey={dataKey} stroke={strokeColor} strokeWidth={2} dot={false} />
    </LineChart>
  </ResponsiveContainer>
);

export default App;
