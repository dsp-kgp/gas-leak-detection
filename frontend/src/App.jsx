import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// --- API URLs ---
// Use environment variable VITE_API_BASE_URL for backend URL if set in .env file,
// otherwise default to localhost:8000. Make sure your backend runs on this port.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_URL_DATA = `${API_BASE_URL}/fetchdata`; // Endpoint to get raw data for table/charts
const API_URL_PREDICTION = `${API_BASE_URL}/latest-prediction`; // Endpoint to get the latest prediction result
const API_URL_TRAIN = `${API_BASE_URL}/train-model`; // Endpoint to trigger model training
const API_URL_MODEL_STATUS = `${API_BASE_URL}/model-status`; // Endpoint to check if a trained model exists
const API_URL_LABEL_UPDATE = `${API_BASE_URL}/label-data`; // Base endpoint to update labels (needs /<record_id>)

const HISTORY_LENGTH = 50; // Maximum number of data points to display in charts and table

// --- SVG Icons (Inline Functional Components) ---
// Using inline SVGs avoids external dependencies like react-icons
const FaThermometerHalf = () => (<svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M256 32C198.3 32 152 78.3 152 136V352c0 53-43 96-96 96s-96-43-96-96c0-20.6 6.2-39.8 17.2-56.2L224 0h64l146.8 299.8C445.8 312.2 452 331.4 452 352c0 53-43 96-96 96s-96-43-96-96V136c0-57.7 46.3-104 104-104zM344 352c0 22.1-17.9 40-40 40s-40-17.9-40-40V136c0-30.9-25.1-56-56-56s-56 25.1-56 56v216c0 22.1-17.9 40-40 40s-40-17.9-40-40c0-10.4 3.9-20 10.8-27.8L224 48.2V48h64v1.8l101.2 276.4c6.9 7.8 10.8 17.4 10.8 27.8z"></path></svg>);
const FaTint = () => (<svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M256 512A256 256 0 0 1 0 256C0 167.6 114.9 32.7 256 0 397.1 32.7 512 167.6 512 256A256 256 0 0 1 256 512zm0-464C147.6 70.2 48 172.3 48 256c0 114.9 93.1 208 208 208s208-93.1 208-208c0-83.7-99.6-185.8-208-208z"></path></svg>);
const FaExclamationTriangle = () => (<svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 576 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M569.517 440.013C587.975 472.007 564.806 512 527.94 512H48.054c-36.937 0-60.035-39.993-41.577-71.987L246.423 23.985c18.467-32.009 64.72-31.951 83.154 0l239.94 416.028zM288 354c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.982 12.654z"></path></svg>);
const FaShieldAlt = () => (<svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M466.5 83.7l-192-80a48.15 48.15 0 0 0-36.9 0l-192 80C27.7 93.7 0 122.4 0 158.5v209C0 422.3 33.2 460.9 76.5 476l192 64a48.15 48.15 0 0 0 36.9 0l192-64C478.8 460.9 512 422.3 512 367.5v-209c0-36.2-27.7-64.8-45.5-74.8zM256 448V256H64V160l192-80v176h192v104l-192 64z"></path></svg>);
const FaChartLine = () => (<svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M500 384c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H12c-6.6 0-12-5.4-12-12V76c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v308h436zM341.5 242.8l-80-80c-4.7-4.7-12.3-4.7-17 0L144 263.5 109.2 229c-4.7-4.7-12.3-4.7-17 0l-40 40c-4.7 4.7-4.7 12.3 0 17l64 64c4.7 4.7 12.3 4.7 17 0l104.5-104c4.7-4.7 12.3-4.7 17 0l80 80c4.7 4.7 12.3 4.7 17 0l80-80c4.7-4.7 4.7-12.3 0-17l-40-40c-4.7-4.7-12.3-4.7-17 0z"></path></svg>);
const FaBrain = () => (<svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 640 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M208 0c-29.4 0-56.1 10-77.3 27.5l-6.3 5.1c-15.3 12.3-25.1 30.1-27.6 49.3C96.3 83 96 84.2 96 85.4V96H48c-26.5 0-48 21.5-48 48v80c0 26.5 21.5 48 48 48h48v16c0 35.3 28.7 64 64 64h16v32c0 12.9 7.8 24.6 19.8 29.6l1.2 .5c3.3 1.4 6.8 2.1 10.4 2.1c8.8 0 17.3-3.5 23.5-9.8l6.1-6.1c9.1-9.1 21.3-14.1 34.2-14.1H320c12.9 0 25.1 5.1 34.2 14.1l6.1 6.1c6.3 6.3 14.7 9.8 23.5 9.8c3.6 0 7.1-.7 10.4-2.1l1.2-.5c12-5 19.8-16.7 19.8-29.6v-32h16c35.3 0 64-28.7 64-64v-16h48c26.5 0 48-21.5 48-48v-80c0-26.5-21.5-48-48-48h-48v-10.6c0-1.2-.3-2.4-.8-3.5c-2.6-19.2-12.4-37-27.6-49.3l-6.3-5.1C472.1 10 445.4 0 416 0H208zM144 144v64h32c8.8 0 16-7.2 16-16v-32c0-8.8-7.2-16-16-16h-32zm48 112c0 8.8-7.2 16-16 16h-32v64h32c8.8 0 16-7.2 16-16v-32c0-8.8-7.2-16-16-16zm64-48v32c0 8.8-7.2 16-16 16h-32v-64h32c8.8 0 16 7.2 16 16zm32 16c0-8.8 7.2-16 16-16h32v64h-32c-8.8 0-16-7.2-16-16v-32zm64-16v32c0 8.8 7.2 16 16 16h32v-64h-32c-8.8 0-16 7.2-16 16zm64-16c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h32v-64h-32zM480 208v-64h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16h-32z"></path></svg>);
const FaCogs = () => (<svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M487.4 315.7l-42.6-24.6c4.3-23.2 4.3-46.4 0-69.6l42.6-24.6c4.9-2.8 7.1-8.6 5.5-14-.1-1.3-.4-2.5-.9-3.8l-37.1-64.4c-2.3-4-6.6-6.4-11.2-6.4s-8.9 2.4-11.2 6.4l-42.6 24.6c-18.2-14.1-38.6-24.6-60.6-30.8v-48.5c0-5.4-4.3-9.7-9.7-9.7h-74.1c-5.4 0-9.7 4.3-9.7 9.7v48.5c-22 6.2-42.4 16.7-60.6 30.8L93.7 94.6c-2.3-4-6.6-6.4-11.2-6.4S73.4 90.6 71.1 94.6L34 159c-1.5 2.6-1.5 5.8 0 7.9l42.6 24.6c-4.3 23.2-4.3 46.4 0 69.6L34 286.1c-4.9 2.8-7.1 8.6-5.5 14 .1 1.3 .4 2.5 .9 3.8l37.1 64.4c2.3 4 6.6 6.4 11.2 6.4s8.9-2.4 11.2-6.4l42.6-24.6c18.2 14.1 38.6 24.6 60.6 30.8v48.5c0 5.4 4.3 9.7 9.7 9.7h74.1c5.4 0 9.7-4.3 9.7-9.7v-48.5c22-6.2 42.4-16.7 60.6-30.8l42.6 24.6c2.3 4 6.6 6.4 11.2 6.4s8.9-2.4 11.2-6.4l37.1-64.4c1.5-2.6 1.5-5.8 0-7.9zM304 288c-26.5 0-48-21.5-48-48s21.5-48 48-48 48 21.5 48 48-21.5 48-48 48z"></path></svg>);


function App() {
    // --- State Variables ---
    const [latestData, setLatestData] = useState(null); // Holds the single most recent raw data record from /fetchdata
    const [dataHistory, setDataHistory] = useState([]); // Holds recent raw data for charts/table (oldest timestamp first after reversing)
    const [prediction, setPrediction] = useState({ status: 'UNKNOWN', probability: 0.0 }); // Latest prediction result from /latest-prediction
    const [status, setStatus] = useState('unknown'); // Overall system status derived from prediction ('safe', 'warning', 'danger', 'unknown', 'error')
    const [error, setError] = useState(null); // Stores general fetch errors or significant operational errors
    const [lastUpdated, setLastUpdated] = useState(null); // Timestamp of the last successful data fetch cycle
    const [isTraining, setIsTraining] = useState(false); // Flag to disable train button during request
    const [trainingMessage, setTrainingMessage] = useState(''); // User feedback message related to the training process
    const [modelExists, setModelExists] = useState(false); // Whether the backend reports a trained model file exists
    const [labelingStatus, setLabelingStatus] = useState({}); // Tracks UI state for label buttons, e.g., { recordId: 'saving' | 'error' | null }

    // --- Data Fetching Effect ---
    useEffect(() => {
        // Function to fetch both raw data history and the latest prediction status
        const fetchApiData = async () => {
             try {
                // Fetch data history and latest prediction concurrently
                const [dataRes, predRes] = await Promise.all([
                    fetch(API_URL_DATA),
                    fetch(API_URL_PREDICTION)
                ]);

                // --- Process Raw Data Response ---
                // Allow 404 Not Found for raw data (means table might be empty, not necessarily an error)
                if (!dataRes.ok && dataRes.status !== 404) {
                     throw new Error(`HTTP error fetching raw data! Status: ${dataRes.status}`);
                 }
                 // Parse JSON if response is OK, otherwise default to an empty array
                const allData = dataRes.ok ? await dataRes.json() : [];

                if (Array.isArray(allData) && allData.length > 0) {
                     // API returns data newest first. Store the very first item (most recent) separately.
                    setLatestData(allData[0]);
                    // Take the specified number of recent items and reverse them for charting (oldest point first)
                    setDataHistory(allData.slice(0, HISTORY_LENGTH).reverse());
                } else {
                     // If no data is returned, clear any potentially stale state
                     console.warn("No historical data available from /fetchdata.");
                     setLatestData(null);
                     setDataHistory([]);
                }

                // --- Process Prediction Response ---
                 // Allow 404 Not Found for prediction (means no predictions made yet)
                if (!predRes.ok && predRes.status !== 404) {
                    throw new Error(`HTTP error fetching prediction! Status: ${predRes.status}`);
                 }
                 // Parse JSON if response is OK, otherwise default to null
                const predictionData = predRes.ok ? await predRes.json() : null;

                if (predictionData) {
                    // Update prediction state and overall status based on the result
                    setPrediction(predictionData);
                    setStatus(predictionData.status.toLowerCase()); // e.g., 'safe', 'warning', 'danger'
                } else {
                    // If no prediction exists yet (e.g., 404), set to a default 'unknown' state
                    setPrediction({ status: 'UNKNOWN', probability: 0.0 });
                    setStatus('unknown');
                    console.warn("No prediction available from /latest-prediction. Model might need training or no prediction data yet.");
                }

                setLastUpdated(new Date()); // Record the time of this successful fetch cycle
                // Clear general error state if this fetch was successful, unless it's specifically a training error message
                if (!trainingMessage.includes('Error initiating training')) {
                   setError(null);
                }

            } catch (e) {
                // Handle network errors or issues parsing JSON responses
                console.error("Failed to fetch data:", e);
                setError(`Data Fetch Error: ${e.message}. Check backend connection and logs.`);
                // Reset states to clearly indicate an error condition
                setLatestData(null);
                // Maybe keep history for context? Or clear: setDataHistory([]);
                setPrediction({ status: 'ERROR', probability: 0.0 }); // Use a specific ERROR status
                setStatus('error');
            }
        };

        // Function to check if the backend has a saved model file
        const checkModelStatus = async () => {
            try {
                const response = await fetch(API_URL_MODEL_STATUS);
                if (response.ok) {
                    const statusData = await response.json();
                    setModelExists(statusData.model_exists); // Update the state for the UI indicator
                    console.log("Model status checked:", statusData);
                } else {
                    // Log if the status check itself fails (e.g., backend down)
                    console.warn(`Could not get model status from backend (status ${response.status}).`);
                }
            } catch (e) {
                // Handle network error during the status check
                console.error("Failed to check model status:", e);
            }
        };

        // Run initial fetches when the component mounts
        fetchApiData();
        checkModelStatus();

        // Set up polling interval to automatically refresh data
        const intervalId = setInterval(fetchApiData, 3000); // Refresh data every 3 seconds

        // Cleanup function: Clear the interval when the component unmounts to prevent memory leaks
        return () => clearInterval(intervalId);
     // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty dependency array ensures this effect runs only once after initial render

    // --- Action Handlers ---

    /**
     * Sends a POST request to the backend API to initiate the model training process.
     * Updates the UI state to show feedback (loading, success, error).
     */
    const handleTrainModel = async () => {
        setIsTraining(true); // Disable the button immediately
        setTrainingMessage('🚀 Training requested... This can take several minutes. Please monitor backend logs for detailed progress and evaluation results.');
        setError(null); // Clear previous non-training errors

        try {
            // Send the request to the training endpoint
            const response = await fetch(API_URL_TRAIN, { method: 'POST' });
            // Assume backend responds with JSON: { message: string, model_exists: bool } or error detail
            const result = await response.json();

            if (!response.ok) {
                // If backend returns an error status code (e.g., 400, 500)
                throw new Error(result.detail || result.message || 'Training request failed. Check backend logs for details.');
            }

            // Display the success message from the backend
            setTrainingMessage(result.message || '✅ Training initiated successfully.');

            // Since training runs in the background, re-check the model status after a delay
            // to update the "Model Ready/No Model" indicator.
            setTimeout(async () => {
                 console.log("Re-checking model status after training request...");
                 try {
                    const statusRes = await fetch(API_URL_MODEL_STATUS);
                    if (statusRes.ok) {
                        const statusData = await statusRes.json();
                        setModelExists(statusData.model_exists);
                        // Append the latest model status message to the initial feedback
                        // Keep the original initiation message and add the current status
                        setTrainingMessage(prev => `${prev.split('|')[0].trim()} | ${statusData.message}`);
                    }
                } catch (e) { console.error("Failed to refresh model status after training:", e);}
                 setIsTraining(false); // Re-enable the train button
            }, 15000); // Check again after 15 seconds (adjust based on typical training time)

        } catch (e) {
            // Handle network errors or errors thrown from the backend response
            console.error("Training request failed:", e);
            const errorMsg = `❌ Error initiating training: ${e.message}`;
            setTrainingMessage(errorMsg);
            setError(errorMsg); // Show the error prominently as well
            setIsTraining(false); // Re-enable the button on error
        }
    };

    /**
     * Sends a PATCH request to update the 'is_leak' label for a specific data record in the database.
     * Optimistically updates the local state for a smoother user experience.
     * @param {number} recordId - The ID of the SensorData record to update.
     * @param {boolean} newLabel - The new label value (true for leak, false for safe).
     */
    const handleLabelUpdate = async (recordId, newLabel) => {
        // Prevent multiple simultaneous updates for the same record
        if (labelingStatus[recordId] === 'saving') return;

        console.log(`Attempting to update record ${recordId} label to is_leak=${newLabel}`);
        // Set UI state for this specific row to 'saving' to provide visual feedback
        setLabelingStatus(prev => ({ ...prev, [recordId]: 'saving' }));
        setError(null); // Clear general errors when attempting labeling

        try {
            // Send the update request to the backend
            const response = await fetch(`${API_URL_LABEL_UPDATE}/${recordId}`, {
                method: 'PATCH', // Use PATCH for updating a specific field
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_leak: newLabel }), // Send the new label value
            });

            if (!response.ok) {
                // Handle backend errors (e.g., 404 record not found, 500 database error)
                const errorData = await response.json();
                throw new Error(errorData.detail || `Failed to update label (status ${response.status})`);
            }

            // Get the fully updated record back from the backend response
            const updatedRecord = await response.json();

            // **Optimistic UI Update**: Update the `dataHistory` state immediately
            // This makes the UI reflect the change instantly.
            setDataHistory(prevHistory => {
                // Find the index of the record to update in the current state array
                 const indexToUpdate = prevHistory.findIndex(r => r.id === recordId);
                 // If the record isn't found in the current view (unlikely but possible), log and return state unchanged
                 if (indexToUpdate === -1) {
                    console.warn(`Record ${recordId} not found in current dataHistory state during optimistic update.`);
                    return prevHistory;
                 }

                 // Create a new array (important for React state updates)
                 const newHistory = [...prevHistory];
                 // Replace the old record with the updated one from the backend response
                 newHistory[indexToUpdate] = updatedRecord; // Use the full updated record
                 return newHistory; // Return the new array to update the state
            });

            // Clear the 'saving' status for this row on success
            setLabelingStatus(prev => ({ ...prev, [recordId]: null }));
            console.log(`✅ Successfully updated label for record ${recordId}`);

        } catch (e) {
            // Handle network errors or errors thrown from the backend response
            console.error(`Error updating label for record ${recordId}:`, e);
            setError(`Failed to save label for record ${recordId}: ${e.message}`); // Show error message
            // Set UI state for this specific row to 'error'
            setLabelingStatus(prev => ({ ...prev, [recordId]: 'error' }));
            // Optional: Automatically clear the row-specific error state after a few seconds
            setTimeout(() => setLabelingStatus(prev => {
                const newState = { ...prev };
                delete newState[recordId]; // Remove the entry for this ID
                return newState;
            }), 4000); // Clear after 4 seconds
        }
    };

    // --- Helper Functions ---

    // Returns the appropriate status icon component based on the current system status
    const getStatusIcon = () => {
        switch (status) { // 'status' is derived from prediction state
            case 'danger': return <FaExclamationTriangle size={40} />;
            case 'warning': return <FaExclamationTriangle size={40} />;
            case 'error': return <FaExclamationTriangle size={40} />; // Specific icon for fetch/backend errors
            case 'unknown': return <FaBrain size={40} />; // Icon when no prediction is available yet
            case 'safe': // Fallthrough for 'safe'
            default: return <FaShieldAlt size={40} />; // Default/safe icon
        }
    };

    // Formats an ISO timestamp string (like "2023-10-27T10:30:00.123Z")
    // into a more readable local time string (e.g., "10:30:05 AM")
    const formatTimestamp = (isoString) => {
        if (!isoString) return ''; // Return empty if no string provided
        try {
             // Use Intl.DateTimeFormat for locale-aware time formatting
             return new Intl.DateTimeFormat(undefined, { // 'undefined' uses browser default locale
                 hour: '2-digit',
                 minute: '2-digit',
                 second: '2-digit',
                 hour12: true // Use AM/PM format
             }).format(new Date(isoString));
            // Simpler alternative:
            // return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (e) {
            console.error("Error formatting timestamp:", isoString, e);
            return 'Invalid Date'; // Fallback for invalid date strings
        }
    };

     // Determines a CSS class ('safe', 'warning', 'danger') based on temperature value
     // Used for coloring the temperature display.
    const getTempStatusClass = (temp) => {
         if (temp === null || temp === undefined) return ''; // No class if temp is missing
        if (temp > 35) return 'danger';
        if (temp > 30) return 'warning';
        return 'safe'; // Default to 'safe' class otherwise
    };

    // --- Render JSX ---
    return (
        <>
            {/* --- Inline Styles --- */}
            {/* Contains all CSS rules for layout, cards, charts, table, buttons, etc. */}
            <style>{`
                /* --- Global Styles & Variables --- */
                :root {
                  --bg-color: #0f172a; /* Dark blue-gray */
                  --card-bg: #1e293b; /* Slightly lighter blue-gray */
                  --text-color: #e2e8f0; /* Light gray */
                  --text-muted: #94a3b8; /* Muted gray */
                  --border-color: #334155; /* Mid blue-gray */
                  --safe-color: #22c55e; /* Green */
                  --warning-color: #f59e0b; /* Amber */
                  --danger-color: #ef4444; /* Red */
                  --accent-color: #3b82f6; /* Blue */
                  --font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                }

                body {
                  margin: 0;
                  font-family: var(--font-family);
                  -webkit-font-smoothing: antialiased;
                  -moz-osx-font-smoothing: grayscale;
                  background-color: var(--bg-color);
                  color: var(--text-color);
                  line-height: 1.6; /* Improved readability */
                }

                /* --- Main App Layout --- */
                .App {
                  text-align: center;
                  padding: 1.5rem 1rem; /* Adjust padding */
                  max-width: 1600px;
                  margin: 0 auto;
                }

                .App-header {
                  margin-bottom: 2.5rem; /* More space below header */
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                }

                .App-header h1 {
                  margin: 0 0 0.5rem 0;
                  font-size: 2.2rem; /* Slightly smaller H1 */
                  font-weight: 700;
                  letter-spacing: -0.5px;
                   color: #f8fafc; /* Lighter heading color */
                }

                .last-updated {
                  color: var(--text-muted);
                  font-size: 0.85rem; /* Smaller font */
                  margin-top: 0.1rem;
                }

                /* --- Training Section --- */
                 .training-controls {
                    display: flex;
                    flex-wrap: wrap; /* Allow wrapping on small screens */
                    align-items: center;
                    justify-content: center;
                    margin-top: 1.5rem; /* More space */
                    gap: 1rem;
                }
                .train-button {
                  background-color: var(--accent-color); /* Use accent color */
                  color: white;
                  padding: 0.6rem 1.2rem; /* Adjusted padding */
                  border: none;
                  border-radius: 6px; /* Standard radius */
                  font-size: 0.95rem; /* Slightly smaller font */
                  font-weight: 500;
                  cursor: pointer;
                  transition: background-color 0.2s ease, transform 0.1s ease, box-shadow 0.2s ease;
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                   box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                }
                .train-button:hover {
                  background-color: #2563eb; /* Darker blue on hover */
                   box-shadow: 0 4px 8px rgba(0,0,0,0.25);
                   transform: translateY(-1px);
                }
                 .train-button:active {
                    transform: translateY(0px); /* Click effect */
                 }
                .train-button:disabled {
                  background-color: #6b7280; /* Gray when disabled */
                  cursor: not-allowed;
                  opacity: 0.7;
                   box-shadow: none;
                   transform: none;
                }
                .training-status {
                  margin-top: 0.75rem; /* Space above feedback */
                  font-size: 0.9rem;
                  color: var(--text-muted);
                  min-height: 1.2em; /* Prevent layout jumps */
                  text-align: center;
                  width: 100%; /* Take full width below button */
                }
                .model-status-indicator {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    padding: 4px 10px; /* Adjusted padding */
                    border-radius: 4px;
                    font-weight: 600; /* Bolder status */
                    text-transform: uppercase; /* Uppercase */
                    letter-spacing: 0.5px;
                }
                .model-status-indicator.exists {
                    background-color: var(--safe-color);
                    color: white;
                     box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }
                .model-status-indicator.not-exists {
                    background-color: var(--warning-color);
                    color: #1f2937; /* Dark text on yellow */
                     box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }

                /* --- Dashboard Grid --- */
                .dashboard-grid {
                  display: grid;
                  /* More responsive columns: min 280px, max 1fr */
                  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                  gap: 1.25rem; /* Slightly less gap */
                  margin: 0 auto;
                }

                /* --- Card Base Styles --- */
                .card {
                  background-color: var(--card-bg);
                  border-radius: 8px; /* Consistent radius */
                  padding: 1rem 1.25rem; /* Adjusted padding */
                  text-align: left;
                  border: 1px solid var(--border-color);
                  transition: transform 0.15s ease-in-out, box-shadow 0.2s ease-in-out;
                  overflow: hidden;
                   box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
                }
                .card:hover {
                  transform: translateY(-3px);
                  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
                }
                .card-icon {
                  font-size: 1.5rem; /* Consistent icon size */
                  margin-right: 0.75rem;
                  opacity: 0.9;
                  flex-shrink: 0;
                   /* Color based on status will be applied specifically */
                }
                .card-content {
                    overflow: hidden;
                    flex-grow: 1;
                }
                .card-content h2, .card-content h3 { /* Combined heading styles */
                  margin: 0 0 0.1rem 0; /* Minimal bottom margin */
                  font-size: 0.9rem; /* Smaller, clearer label */
                  font-weight: 500; /* Medium weight */
                  color: var(--text-muted);
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                   text-transform: uppercase; /* Uppercase labels */
                   letter-spacing: 0.5px;
                }
                .card-content p { /* Value display */
                  margin: 0;
                  font-size: 1.75rem; /* Prominent value */
                  font-weight: 600; /* Semi-bold */
                  line-height: 1.3;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                   color: var(--text-color); /* Default value color */
                }

                /* --- Specific Card Styles --- */
                .status-card, .data-card {
                  display: flex;
                  align-items: center;
                }
                .status-card .status-text {
                  font-size: 2rem; /* Adjusted status text */
                  font-weight: 700; /* Bold */
                  text-transform: uppercase;
                   /* Color applied via parent class */
                }

                /* --- Chart Styles --- */
                .chart-card {
                  grid-column: 1 / -1; /* Full width by default */
                   padding-bottom: 0.5rem; /* Reduce bottom padding */
                }
                .chart-title {
                  display: flex;
                  align-items: center;
                  gap: 0.5rem; /* Smaller gap */
                  margin-bottom: 0.8rem; /* Less space */
                  font-size: 1rem; /* Adjusted title size */
                  font-weight: 600;
                  color: var(--text-color); /* Lighter title */
                }
                 /* Recharts Tooltip Styling */
                 .recharts-default-tooltip {
                    background-color: rgba(15, 23, 42, 0.9) !important; /* --bg-color with opacity */
                    border: 1px solid var(--border-color) !important;
                    border-radius: 6px !important;
                     box-shadow: 0 4px 8px rgba(0,0,0,0.3);
                     padding: 0.5rem 0.75rem !important;
                }
                .recharts-tooltip-label {
                    color: #cbd5e1 !important; /* Slightly lighter muted */
                    font-size: 0.8rem !important;
                    margin-bottom: 0.3rem !important;
                    font-weight: 600;
                 }
                .recharts-tooltip-item-list {
                    font-size: 0.85rem !important;
                }
                .recharts-tooltip-item {
                   color: var(--text-color) !important;
                }
                 /* Chart Axis Styling */
                 .recharts-cartesian-axis-tick-value tspan {
                    font-size: 11px; /* Smaller axis labels */
                    fill: var(--text-muted);
                 }


                /* --- Table Styles --- */
                .table-card {
                  grid-column: 1 / -1;
                }
                .table-card h2 {
                    margin: 0 0 1rem 0; /* Consistent margin */
                    font-size: 1.1rem; /* Adjusted heading */
                    font-weight: 600;
                    color: var(--text-color);
                }
                .table-wrapper {
                    max-height: 350px;
                    overflow: auto; /* Use auto for scrollbar */
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    /* Custom Scrollbar (Webkit) */
                    &::-webkit-scrollbar { width: 6px; }
                    &::-webkit-scrollbar-track { background: var(--card-bg); border-radius: 3px; }
                    &::-webkit-scrollbar-thumb { background-color: var(--border-color); border-radius: 3px; border: 1px solid var(--card-bg); }
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem; /* Smaller table text */
                }
                th, td {
                    padding: 8px 10px; /* Compact padding */
                    text-align: left;
                    border-bottom: 1px solid var(--border-color);
                    white-space: nowrap;
                    vertical-align: middle; /* Align button vertically */
                }
                thead th {
                    background-color: #334155; /* Header background */
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    font-weight: 600;
                    color: var(--text-color); /* Lighter header text */
                     white-space: normal; /* Allow header text wrapping */
                }
                 tbody tr { transition: background-color 0.15s ease; }
                tbody tr:hover { background-color: #2a3a50; } /* Subtle hover */
                /* Center actions column */
                 th:last-child { text-align: center; }
                 td:last-child { text-align: center; }

                /* --- Label Buttons Styles --- */
                 .label-buttons {
                    display: flex;
                    gap: 6px; /* Space between buttons */
                    justify-content: center;
                    align-items: center;
                }
                .label-button {
                    padding: 4px 8px; /* Compact button */
                    font-size: 0.75rem;
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    cursor: pointer;
                    background-color: transparent;
                    color: var(--text-muted);
                    transition: all 0.2s ease;
                    min-width: 45px; /* Minimum size */
                    text-align: center;
                    font-weight: 500;
                }
                .label-button:hover:not(:disabled) { /* Hover only if not disabled */
                    background-color: var(--border-color);
                    color: var(--text-color);
                    border-color: #4b5f78; /* Slightly lighter border */
                }
                .label-button.active-leak {
                    background-color: var(--danger-color);
                    color: white;
                    border-color: var(--danger-color);
                    font-weight: 600;
                }
                .label-button.active-safe {
                    background-color: var(--safe-color);
                    color: white;
                    border-color: var(--safe-color);
                    font-weight: 600;
                }
                .label-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                /* Status text within the label column */
                 .label-status {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    display: inline-block; /* Allows padding/margin */
                    padding: 4px 0;
                }
                .label-status.error { /* Style for error message */
                    color: var(--danger-color);
                    font-weight: 500;
                }

                /* --- Status Colors --- */
                /* Apply color to specific value elements */
                .value.safe { color: var(--safe-color); }
                .value.warning { color: var(--warning-color); }
                .value.danger { color: var(--danger-color); }
                .value.unknown { color: var(--text-muted); }
                .value.error { color: var(--danger-color); }

                /* Apply color to status card text and icon based on parent class */
                .status-card.safe .status-text, .status-card.safe .card-icon { color: var(--safe-color); }
                .status-card.warning .status-text, .status-card.warning .card-icon { color: var(--warning-color); }
                .status-card.danger .status-text, .status-card.danger .card-icon { color: var(--danger-color); }
                .status-card.unknown .status-text, .status-card.unknown .card-icon { color: var(--text-muted); }
                .status-card.error .status-text, .status-card.error .card-icon { color: var(--danger-color); }


                /* --- Error/Loading Placeholders --- */
                .error-card, .loading-card {
                  background-color: var(--card-bg);
                  border-radius: 8px;
                  padding: 1.5rem;
                  max-width: 600px;
                  margin: 2rem auto; /* Center these feedback cards */
                  border: 1px solid var(--border-color);
                  text-align: center;
                  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }
                .error-card {
                  background-color: #441c1c; /* Darker red */
                  border-color: var(--danger-color);
                  color: #fecaca; /* Light red text */
                  font-weight: 500;
                }
                .loading-card {
                    color: var(--text-muted);
                    font-style: italic;
                }
                 .no-data-message {
                     color: var(--text-muted);
                     text-align: center;
                     margin-top: 2rem;
                     font-style: italic;
                 }


                /* --- Responsive Design Adjustments --- */
                 /* Medium screens (e.g., tablets) */
                @media (min-width: 768px) {
                    .chart-card {
                        grid-column: span 1; /* Charts take half width */
                    }
                     .dashboard-grid {
                         /* 2 columns for data cards */
                        grid-template-columns: repeat(2, 1fr);
                      }
                      .status-card {
                        grid-column: 1 / -1; /* Status card spans full width */
                     }
                      .table-card {
                         grid-column: 1 / -1; /* Table spans full width */
                      }
                       .App-header h1 { font-size: 2.5rem; }
                       .card-content p { font-size: 2rem; }
                       .status-card .status-text { font-size: 2.2rem; }
                }
                /* Larger screens (desktops) */
                @media (min-width: 1200px) {
                   .dashboard-grid {
                    grid-template-columns: repeat(3, 1fr); /* 3 columns layout */
                  }
                   /* Allow status and data cards to naturally fit into the 3 columns */
                  .status-card, .data-card, .chart-card {
                    grid-column: span 1;
                  }
                   .table-card {
                      grid-column: 1 / -1; /* Table still spans full width */
                   }
                   .App-header h1 { font-size: 2.8rem; }
                }
            `}</style>

            {/* --- App Structure --- */}
            <div className="App">
                <header className="App-header">
                    <h1>Gas Leak Detection Dashboard</h1>
                    {lastUpdated && <p className="last-updated">Last Updated: {lastUpdated.toLocaleTimeString()}</p>}

                    {/* Training Button and Model Status Indicator */}
                    <div className="training-controls">
                        <button
                            className="train-button"
                            onClick={handleTrainModel}
                            disabled={isTraining} // Disable while training request is processing
                        >
                            <FaCogs /> {isTraining ? 'Training...' : 'Train Model'}
                        </button>
                        {/* Shows 'Model Ready' or 'No Model' based on backend check */}
                        <span className={`model-status-indicator ${modelExists ? 'exists' : 'not-exists'}`}>
                             {modelExists ? 'Model Ready' : 'No Model'}
                         </span>
                    </div>
                     {/* Displays feedback messages from the training process */}
                     {trainingMessage && <p className="training-status">{trainingMessage}</p>}
                </header>

                {/* --- Error and Loading States --- */}
                {/* Display general fetch errors, unless masked by a specific training error message */}
                {error && !trainingMessage.includes('Error initiating training') && (
                    <div className="error-card">{error}</div>
                )}
                {/* Display loading message only if no error and no initial data/prediction yet */}
                {!latestData && !error && status !== 'error' && status !== 'unknown' && (
                    <div className="loading-card">Connecting to Backend and Fetching Data...</div>
                )}

                {/* --- Dashboard Grid --- */}
                {/* Render grid even if some data is missing to maintain layout */}
                <main className="dashboard-grid">

                    {/* Status Card - Displays overall system status based on prediction */}
                    <div className={`status-card card ${status}`}>
                        <div className="card-icon">{getStatusIcon()}</div>
                        <div className="card-content">
                            <h2>System Status</h2>
                            <p className="status-text">
                                {/* Show prediction status or loading/error indicator */}
                                {prediction.status?.toUpperCase() || (error ? 'ERROR' : 'LOADING...')}
                            </p>
                        </div>
                    </div>

                    {/* Prediction Confidence Card */}
                     <div className="data-card card">
                        <div className="card-icon"><FaBrain /></div>
                        <div className="card-content">
                            <h2>Leak Confidence</h2> {/* Changed to H2 for consistency */}
                            <p className={`value ${status}`}>
                                {/* Safely display probability, show '-' if unavailable */}
                                {(prediction.probability !== null && prediction.probability !== undefined && status !== 'error')
                                     ? `${(prediction.probability * 100).toFixed(0)} %`
                                     : '-'}
                            </p>
                        </div>
                    </div>

                    {/* Temperature Card - Displays latest temperature */}
                    <div className="data-card card">
                        <div className="card-icon"><FaThermometerHalf style={{ color: latestData ? (getTempStatusClass(latestData.temp) === 'danger' ? 'var(--danger-color)' : getTempStatusClass(latestData.temp) === 'warning' ? 'var(--warning-color)' : 'var(--text-muted)') : 'var(--text-muted)' }} /></div>
                        <div className="card-content">
                            <h2>Temperature</h2>
                            <p className={`value ${latestData ? getTempStatusClass(latestData.temp) : ''}`}>
                                {/* Use optional chaining and nullish coalescing for safety */}
                                {latestData?.temp?.toFixed(1) ?? '-'} °C
                            </p>
                        </div>
                    </div>

                    {/* Humidity Card - Displays latest humidity */}
                    <div className="data-card card">
                        <div className="card-icon"><FaTint style={{ color: 'var(--accent-color)' }}/></div>
                        <div className="card-content">
                            <h2>Humidity</h2>
                            <p className="value">
                                {latestData?.humidity?.toFixed(1) ?? '-'} %
                            </p>
                        </div>
                    </div>

                    {/* --- Charts --- */}
                     {/* Worker 1 Chart */}
                    <div className="chart-card card">
                        <h3 className="chart-title"><FaChartLine /> Worker 1 - Max Reading</h3>
                        <ResponsiveContainer width="100%" height={200}>
                             {/* Conditionally render chart or 'No data' message */}
                             {dataHistory.length > 1 ? ( // Need at least 2 points for a line
                                <LineChart data={dataHistory} margin={{ top: 5, right: 15, left: -15, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={ "var(--border-color)"} />
                                    <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} stroke="var(--text-muted)" fontSize={11} interval="preserveStartEnd" tickCount={5} />
                                    <YAxis stroke="var(--text-muted)" fontSize={11} domain={['auto', 'auto']} width={40}/>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px' }}
                                        labelStyle={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '5px' }}
                                        itemStyle={{ color: 'var(--text-color)', fontSize: '0.85rem' }}
                                        labelFormatter={formatTimestamp}
                                    />
                                    {/* connectNulls helps render lines even if some data points are missing */}
                                    <Line type="monotone" dataKey="worker_1_max" name="W1 Max" stroke="#8884d8" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
                                </LineChart>
                            ) : (<p className="no-data-message">Insufficient data for chart.</p>)}
                        </ResponsiveContainer>
                    </div>

                     {/* Worker 2 Chart */}
                    <div className="chart-card card">
                         <h3 className="chart-title"><FaChartLine /> Worker 2 - Max Reading</h3>
                        <ResponsiveContainer width="100%" height={200}>
                             {dataHistory.length > 1 ? (
                                <LineChart data={dataHistory} margin={{ top: 5, right: 15, left: -15, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                    <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} stroke="var(--text-muted)" fontSize={11} interval="preserveStartEnd" tickCount={5}/>
                                    <YAxis stroke="var(--text-muted)" fontSize={11} domain={['auto', 'auto']} width={40}/>
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px' }} labelStyle={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '5px' }} itemStyle={{ color: 'var(--text-color)', fontSize: '0.85rem' }} labelFormatter={formatTimestamp} />
                                     <Line type="monotone" dataKey="worker_2_max" name="W2 Max" stroke="#82ca9d" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls/>
                                </LineChart>
                            ) : (<p className="no-data-message">Insufficient data for chart.</p>)}
                        </ResponsiveContainer>
                    </div>

                    {/* Worker 3 Chart */}
                    <div className="chart-card card">
                         <h3 className="chart-title"><FaChartLine /> Worker 3 - Max Reading</h3>
                        <ResponsiveContainer width="100%" height={200}>
                             {dataHistory.length > 1 ? (
                                <LineChart data={dataHistory} margin={{ top: 5, right: 15, left: -15, bottom: 0 }}>
                                     <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                    <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} stroke="var(--text-muted)" fontSize={11} interval="preserveStartEnd" tickCount={5}/>
                                    <YAxis stroke="var(--text-muted)" fontSize={11} domain={['auto', 'auto']} width={40}/>
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '6px' }} labelStyle={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '5px' }} itemStyle={{ color: 'var(--text-color)', fontSize: '0.85rem' }} labelFormatter={formatTimestamp} />
                                     <Line type="monotone" dataKey="worker_3_max" name="W3 Max" stroke="#ffc658" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls/>
                                </LineChart>
                            ) : (<p className="no-data-message">Insufficient data for chart.</p>)}
                        </ResponsiveContainer>
                    </div>


                    {/* --- Recent Raw Data Table (for Labeling) --- */}
                    <div className="table-card card">
                        <h2>Recent Raw Data (for Labeling)</h2>
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Temp (°C)</th>
                                        <th>Humidity (%)</th>
                                        <th>W1 Max</th>
                                        <th>W2 Max</th>
                                        <th>W3 Max</th>
                                        <th>Label Actions</th> {/* Column for labeling buttons */}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Show newest records first in the table by reversing a copy */}
                                    {dataHistory.length > 0 ? (
                                        [...dataHistory].reverse().map(record => {
                                            // Get the current UI status for this row's label buttons
                                            const currentLabelingState = labelingStatus[record.id];
                                            const isCurrentlyLeak = record.is_leak === true;
                                            const isCurrentlySafe = record.is_leak === false;
                                            const isSaving = currentLabelingState === 'saving';
                                            const isError = currentLabelingState === 'error';

                                            return (
                                                <tr key={record.id}>
                                                    {/* Data Cells */}
                                                    <td>{new Date(record.timestamp).toLocaleString()}</td>
                                                    <td>{record.temp?.toFixed(1) ?? 'N/A'}</td>
                                                    <td>{record.humidity?.toFixed(1) ?? 'N/A'}</td>
                                                    <td>{record.worker_1_max ?? 'N/A'}</td>
                                                    <td>{record.worker_2_max ?? 'N/A'}</td>
                                                    <td>{record.worker_3_max ?? 'N/A'}</td>

                                                    {/* Label Actions Cell */}
                                                    <td>
                                                        {isSaving ? (
                                                            <span className="label-status">Saving...</span>
                                                        ) : isError ? (
                                                            <span className="label-status error">Error!</span>
                                                        ) : (
                                                            // Render buttons if not saving/error
                                                            <div className="label-buttons">
                                                                <button
                                                                    className={`label-button ${isCurrentlyLeak ? 'active-leak' : ''}`}
                                                                    onClick={() => handleLabelUpdate(record.id, true)}
                                                                    // Disable if already marked as leak or if another action is in progress for this row
                                                                    disabled={isCurrentlyLeak || isSaving}
                                                                    title="Mark this record as a Leak event"
                                                                >
                                                                    Leak
                                                                </button>
                                                                <button
                                                                    className={`label-button ${isCurrentlySafe ? 'active-safe' : ''}`}
                                                                    onClick={() => handleLabelUpdate(record.id, false)}
                                                                    // Disable if already marked as safe or if another action is in progress
                                                                    disabled={isCurrentlySafe || isSaving}
                                                                    title="Mark this record as Safe (No Leak)"
                                                                >
                                                                    Safe
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        // Message shown when the dataHistory array is empty
                                        <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>No recent raw data collected for labeling yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}

export default App;
