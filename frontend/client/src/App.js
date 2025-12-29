import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, AlertCircle, BarChart3, Search, Filter, ChevronLeft, ChevronRight, X, Users, ChevronUp, ChevronDown, Brain } from 'lucide-react';
import StrategyDetail from './StrategyDetail';
import ModelDetail from './ModelDetail';
import UserManagement from './UserManagement';
import Header from './components/Header';
import { AuthProvider } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AuthModal from './components/AuthModal';
import Account from './Account';
import './App.css';

// Strategy List Component
function StrategyList() {
  const [strategies, setStrategies] = useState([]);
  const [filteredStrategies, setFilteredStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterExchange, setFilterExchange] = useState('all');
  const [filterSymbol, setFilterSymbol] = useState('all');
  const [filterTimeframe, setFilterTimeframe] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'pnl', direction: 'desc' });
  const navigate = useNavigate();

  useEffect(() => {
    fetchStrategies();
  }, []);

  const filterStrategies = useCallback(() => {
    let filtered = strategies;
    if (searchTerm) {
      filtered = filtered.filter(strategy =>
        strategy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        strategy.parameters.exchange.toLowerCase().includes(searchTerm.toLowerCase()) ||
        strategy.parameters.symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterExchange !== 'all') {
      filtered = filtered.filter(strategy => strategy.parameters.exchange === filterExchange);
    }
    if (filterSymbol !== 'all') {
      filtered = filtered.filter(strategy => strategy.parameters.symbol === filterSymbol);
    }
    if (filterTimeframe !== 'all') {
      filtered = filtered.filter(strategy => strategy.parameters.timeframe === filterTimeframe);
    }
    setFilteredStrategies(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [strategies, searchTerm, filterExchange, filterSymbol, filterTimeframe]);

  useEffect(() => {
    filterStrategies();
  }, [strategies, searchTerm, filterExchange, filterSymbol, filterTimeframe, filterStrategies]);

  const fetchStrategies = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/strategies');
      setStrategies(response.data.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch strategies. Please make sure the server is running and database is connected.');
      console.error('Error fetching strategies:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (amount) => {
    return `${amount >= 0 ? '+' : ''}${amount.toFixed(2)}%`;
  };

  const getUniqueExchanges = () => {
    return [...new Set(strategies.map(s => s.parameters.exchange))];
  };

  const getUniqueSymbols = () => {
    return [...new Set(strategies.map(s => s.parameters.symbol))];
  };

  const getUniqueTimeframes = () => {
    return [...new Set(strategies.map(s => s.parameters.timeframe))];
  };

  // Sorting function
  const sortStrategies = useCallback((strategies, sortConfig) => {
    if (!sortConfig.key) return strategies;

    return [...strategies].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'exchange':
          aValue = a.parameters.exchange.toLowerCase();
          bValue = b.parameters.exchange.toLowerCase();
          break;
        case 'symbol':
          aValue = a.parameters.symbol.toLowerCase();
          bValue = b.parameters.symbol.toLowerCase();
          break;
        case 'timeframe':
          aValue = a.parameters.timeframe.toLowerCase();
          bValue = b.parameters.timeframe.toLowerCase();
          break;
        case 'pnl':
          aValue = a.performance.profitLoss;
          bValue = b.performance.profitLoss;
          break;
        case 'status':
          aValue = a.status.toLowerCase();
          bValue = b.status.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, []);

  // Apply sorting to filtered strategies
  const sortedStrategies = useMemo(() => {
    return sortStrategies(filteredStrategies, sortConfig);
  }, [filteredStrategies, sortConfig, sortStrategies]);

  // Handle sort
  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get sort icon
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ChevronUp className="w-4 h-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-blue-600" />
      : <ChevronDown className="w-4 h-4 text-blue-600" />;
  };

  // Calculate summary statistics
  const getSummaryStats = () => {
    if (strategies.length === 0) return { totalPnL: 0, avgPnL: 0, profitableCount: 0 };
    
    const totalPnL = strategies.reduce((sum, s) => sum + s.performance.profitLoss, 0);
    const avgPnL = totalPnL / strategies.length;
    const profitableCount = strategies.filter(s => s.performance.profitLoss > 0).length;
    
    return { totalPnL, avgPnL, profitableCount };
  };

  // Pagination logic
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = sortedStrategies.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(sortedStrategies.length / recordsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages.map(page => (
      <button
        key={page}
        onClick={() => handlePageChange(page)}
        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
          currentPage === page
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm border border-gray-200'
        }`}
      >
        {page}
      </button>
    ));
  };

  const handleStrategyClick = (strategy) => {
    navigate(`/strategy/${strategy.name}`);
  };

  const summaryStats = getSummaryStats();

    if (loading) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-300 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading strategies...</p>
          <p className="text-sm text-gray-500 mt-2">Preparing your dashboard</p>
          </div>
        </div>
      );
    }

    return (
    <div className="min-h-screen bg-gray-50">
      <Header activePage="simulator" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Professional Introduction Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Advanced Trading Strategy Analytics</h2>
            <p className="text-lg text-gray-600 mb-6 max-w-3xl mx-auto">
              Monitor and analyze the performance of your cryptocurrency trading strategies in real-time. 
              Track profit/loss percentages, identify profitable patterns, and optimize your trading decisions 
              with comprehensive analytics and detailed performance metrics.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <BarChart3 className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Real-time Monitoring</h3>
                <p className="text-xs text-gray-600">Live performance tracking across all strategies</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Performance Analytics</h3>
                <p className="text-xs text-gray-600">Detailed P&L analysis and trend identification</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Strategy Optimization</h3>
                <p className="text-xs text-gray-600">Identify and optimize profitable trading patterns</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search strategies by name, exchange, or symbol..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  showFilters || filterExchange !== 'all' || filterSymbol !== 'all' || filterTimeframe !== 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {(filterExchange !== 'all' || filterSymbol !== 'all' || filterTimeframe !== 'all') && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {[filterExchange, filterSymbol, filterTimeframe].filter(f => f !== 'all').length}
                  </span>
                )}
              </button>
              
              {(searchTerm || filterExchange !== 'all' || filterSymbol !== 'all' || filterTimeframe !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterExchange('all');
                    setFilterSymbol('all');
                    setFilterTimeframe('all');
                    setShowFilters(false);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
          
          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Exchange</label>
                  <select
                    value={filterExchange}
                    onChange={(e) => setFilterExchange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="all">All Exchanges</option>
                    {getUniqueExchanges().map(exchange => (
                      <option key={exchange} value={exchange}>{exchange.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Symbol</label>
                  <select
                    value={filterSymbol}
                    onChange={(e) => setFilterSymbol(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="all">All Symbols</option>
                    {getUniqueSymbols().map(symbol => (
                      <option key={symbol} value={symbol}>{symbol.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timeframe</label>
                  <select
                    value={filterTimeframe}
                    onChange={(e) => setFilterTimeframe(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  >
                    <option value="all">All Timeframes</option>
                    {getUniqueTimeframes().map(timeframe => (
                      <option key={timeframe} value={timeframe}>{timeframe.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Strategies Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Trading Strategies</h2>
                <p className="text-sm text-gray-600 mt-1">Performance monitoring and analysis</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  {sortedStrategies.length} Active
                </div>
                <div className="text-sm text-gray-600">
                  Showing {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, sortedStrategies.length)} of {sortedStrategies.length}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-gray-100 to-blue-100">
                <tr>
                  <th 
                    className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-200 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Strategy</span>
                      {getSortIcon('name')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-200 transition-colors"
                    onClick={() => handleSort('exchange')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Exchange</span>
                      {getSortIcon('exchange')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-200 transition-colors"
                    onClick={() => handleSort('symbol')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Symbol</span>
                      {getSortIcon('symbol')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-200 transition-colors"
                    onClick={() => handleSort('timeframe')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Timeframe</span>
                      {getSortIcon('timeframe')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-200 transition-colors"
                    onClick={() => handleSort('pnl')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>P&L</span>
                      {getSortIcon('pnl')}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-blue-200 transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Status</span>
                      {getSortIcon('status')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentRecords.map((strategy) => (
                  <tr 
                    key={strategy.id} 
                    className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-300 transform hover:scale-[1.01] hover:shadow-md cursor-pointer"
                    onClick={() => handleStrategyClick(strategy)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                      <div className="text-sm font-semibold text-gray-900">{strategy.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-1 rounded-full inline-block">
                        {strategy.parameters.exchange.toUpperCase()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 bg-blue-50 px-3 py-1 rounded-full inline-block">
                        {strategy.parameters.symbol.toUpperCase()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 bg-green-50 px-3 py-1 rounded-full inline-block">
                        {strategy.parameters.timeframe}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {strategy.performance.profitLoss >= 0 ? (
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                              {formatPercentage(strategy.performance.profitLoss)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <TrendingDown className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                              {formatPercentage(strategy.performance.profitLoss)}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                        strategy.status === 'Active' 
                          ? 'bg-green-100 text-green-800 border border-green-200' 
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                        <div className={`w-2 h-2 rounded-full mr-2 ${
                          strategy.status === 'Active' ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        {strategy.status}
                            </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sortedStrategies.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || filterExchange !== 'all' || filterSymbol !== 'all' || filterTimeframe !== 'all' 
                  ? 'No strategies match your filters' 
                  : 'No strategies found'}
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                {searchTerm || filterExchange !== 'all' || filterSymbol !== 'all' || filterTimeframe !== 'all'
                  ? 'Try adjusting your search or filter criteria to find matching strategies.'
                  : 'No strategies are currently configured in the database.'}
              </p>
            </div>
          )}
        </div>

        {/* Enhanced Pagination */}
          {sortedStrategies.length > 0 && totalPages > 1 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                Showing <span className="font-medium text-blue-600">{indexOfFirstRecord + 1}</span> to <span className="font-medium text-blue-600">{Math.min(indexOfLastRecord, sortedStrategies.length)}</span> of <span className="font-medium text-blue-600">{sortedStrategies.length}</span> results
                </div>
              
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 border border-gray-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>
                  
                  <div className="flex items-center space-x-1">
                  {renderPageNumbers()}
                  </div>
                  
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 border border-gray-200"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}

// Models List Component
function ModelsList() {
  const [models, setModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterExchange, setFilterExchange] = useState('all');
  const [filterSymbol, setFilterSymbol] = useState('all');
  const [filterTimeframe, setFilterTimeframe] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'final_pnl', direction: 'desc' });
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'
  const navigate = useNavigate();

  useEffect(() => {
    fetchModels();
  }, []);

  const filterModels = useCallback(() => {
    let filtered = models;
    if (searchTerm) {
      filtered = filtered.filter(model =>
        model.model_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.exchange.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.symbol.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterExchange !== 'all') {
      filtered = filtered.filter(model => model.exchange === filterExchange);
    }
    if (filterSymbol !== 'all') {
      filtered = filtered.filter(model => model.symbol === filterSymbol);
    }
    if (filterTimeframe !== 'all') {
      filtered = filtered.filter(model => model.time_horizon === filterTimeframe);
    }
    setFilteredModels(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [models, searchTerm, filterExchange, filterSymbol, filterTimeframe]);

  useEffect(() => {
    filterModels();
  }, [models, searchTerm, filterExchange, filterSymbol, filterTimeframe, filterModels]);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/models');
      setModels(response.data.data || response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch ML models. Please make sure the server is running and database is connected.');
      console.error('Error fetching models:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (amount) => {
    return `${amount >= 0 ? '+' : ''}${amount.toFixed(2)}%`;
  };

  const getUniqueExchanges = () => {
    return [...new Set(models.map(m => m.exchange))];
  };

  const getUniqueSymbols = () => {
    return [...new Set(models.map(m => m.symbol))];
  };

  const getUniqueTimeframes = () => {
    return [...new Set(models.map(m => m.time_horizon))];
  };

  // Sorting function
  const sortModels = useCallback((models, sortConfig) => {
    if (!sortConfig.key) return models;

    return [...models].sort((a, b) => {
      let aValue, bValue;

      switch (sortConfig.key) {
        case 'model_name':
          aValue = a.model_name.toLowerCase();
          bValue = b.model_name.toLowerCase();
          break;
        case 'exchange':
          aValue = a.exchange.toLowerCase();
          bValue = b.exchange.toLowerCase();
          break;
        case 'symbol':
          aValue = a.symbol.toLowerCase();
          bValue = b.symbol.toLowerCase();
          break;
        case 'time_horizon':
          aValue = a.time_horizon.toLowerCase();
          bValue = b.time_horizon.toLowerCase();
          break;
        case 'final_pnl':
          aValue = a.final_pnl;
          bValue = b.final_pnl;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, []);

  // Apply sorting to filtered models
  const sortedModels = useMemo(() => {
    return sortModels(filteredModels, sortConfig);
  }, [filteredModels, sortConfig, sortModels]);

  // Handle sort
  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get sort icon
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ChevronUp className="w-4 h-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-purple-600" />
      : <ChevronDown className="w-4 h-4 text-purple-600" />;
  };

  // Calculate summary statistics
  const getSummaryStats = () => {
    if (models.length === 0) return { totalPnL: 0, avgPnL: 0, profitableCount: 0 };
    
    const totalPnL = models.reduce((sum, m) => sum + m.final_pnl, 0);
    const avgPnL = totalPnL / models.length;
    const profitableCount = models.filter(m => m.final_pnl > 0).length;
    
    return { totalPnL, avgPnL, profitableCount };
  };

  // Pagination logic
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = sortedModels.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(sortedModels.length / recordsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages.map(page => (
      <button
        key={page}
        onClick={() => handlePageChange(page)}
        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
          currentPage === page
            ? 'bg-purple-600 text-white shadow-md'
            : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm border border-gray-200'
        }`}
      >
        {page}
      </button>
    ));
  };

  const handleModelClick = (model) => {
    navigate(`/model/${model.table_name}`);
  };

  const summaryStats = getSummaryStats();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-300 border-t-purple-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading ML models...</p>
        <p className="text-sm text-gray-500 mt-2">Preparing your AI dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      <Header activePage="models" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Professional Introduction Section */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 mb-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-4">AI-Powered Trading Analytics</h2>
            <p className="text-lg text-gray-600 mb-6 max-w-3xl mx-auto">
              Monitor and analyze the performance of your machine learning trading models in real-time. 
              Track profit/loss percentages, identify profitable patterns, and optimize your AI-based trading decisions 
              with comprehensive analytics and detailed performance metrics.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Neural Networks</h3>
                <p className="text-xs text-gray-600">Advanced ML models for market prediction</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Performance Analytics</h3>
                <p className="text-xs text-gray-600">Detailed P&L analysis and trend identification</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                  <BarChart3 className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Model Optimization</h3>
                <p className="text-xs text-gray-600">Identify and optimize profitable ML patterns</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex-1 max-w-lg">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search models by name, exchange, or symbol..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-white/50 backdrop-blur-sm"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    viewMode === 'table'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    viewMode === 'cards'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Cards
                </button>
              </div>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  showFilters || filterExchange !== 'all' || filterSymbol !== 'all' || filterTimeframe !== 'all'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Filter className="w-4 h-4" />
                <span>Filters</span>
                {(filterExchange !== 'all' || filterSymbol !== 'all' || filterTimeframe !== 'all') && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {[filterExchange, filterSymbol, filterTimeframe].filter(f => f !== 'all').length}
                  </span>
                )}
              </button>
              
              {(searchTerm || filterExchange !== 'all' || filterSymbol !== 'all' || filterTimeframe !== 'all') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterExchange('all');
                    setFilterSymbol('all');
                    setFilterTimeframe('all');
                    setShowFilters(false);
                  }}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium px-3 py-2 rounded-lg hover:bg-purple-50 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
          
          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Exchange</label>
                  <select
                    value={filterExchange}
                    onChange={(e) => setFilterExchange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-white/50"
                  >
                    <option value="all">All Exchanges</option>
                    {getUniqueExchanges().map(exchange => (
                      <option key={exchange} value={exchange}>{exchange.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Symbol</label>
                  <select
                    value={filterSymbol}
                    onChange={(e) => setFilterSymbol(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-white/50"
                  >
                    <option value="all">All Symbols</option>
                    {getUniqueSymbols().map(symbol => (
                      <option key={symbol} value={symbol}>{symbol.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timeframe</label>
                  <select
                    value={filterTimeframe}
                    onChange={(e) => setFilterTimeframe(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-white/50"
                  >
                    <option value="all">All Timeframes</option>
                    {getUniqueTimeframes().map(timeframe => (
                      <option key={timeframe} value={timeframe}>{timeframe.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Models Display */}
        {viewMode === 'table' ? (
          /* Enhanced Models Table */
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">ML Trading Models</h2>
                  <p className="text-sm text-gray-600 mt-1">Performance monitoring and analysis</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                    {sortedModels.length} Active
                  </div>
                  <div className="text-sm text-gray-600">
                    Showing {indexOfFirstRecord + 1}-{Math.min(indexOfLastRecord, sortedModels.length)} of {sortedModels.length}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gradient-to-r from-purple-100 to-indigo-100">
                  <tr>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-purple-200 transition-colors"
                      onClick={() => handleSort('model_name')}
                    >
                      <div className="flex items-center space-x-2">
                        <span>Model</span>
                        {getSortIcon('model_name')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-purple-200 transition-colors"
                      onClick={() => handleSort('exchange')}
                    >
                      <div className="flex items-center space-x-2">
                        <span>Exchange</span>
                        {getSortIcon('exchange')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-purple-200 transition-colors"
                      onClick={() => handleSort('symbol')}
                    >
                      <div className="flex items-center space-x-2">
                        <span>Symbol</span>
                        {getSortIcon('symbol')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-purple-200 transition-colors"
                      onClick={() => handleSort('time_horizon')}
                    >
                      <div className="flex items-center space-x-2">
                        <span>Timeframe</span>
                        {getSortIcon('time_horizon')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-purple-200 transition-colors"
                      onClick={() => handleSort('final_pnl')}
                    >
                      <div className="flex items-center space-x-2">
                        <span>P&L</span>
                        {getSortIcon('final_pnl')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white/50 divide-y divide-gray-200">
                  {currentRecords.map((model) => (
                    <tr 
                      key={model.id} 
                      className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 transition-all duration-300 transform hover:scale-[1.01] hover:shadow-md cursor-pointer"
                      onClick={() => handleModelClick(model)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                        <div className="text-sm font-semibold text-gray-900">{model.model_name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 bg-gray-50 px-3 py-1 rounded-full inline-block">
                          {model.exchange.toUpperCase()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 bg-blue-50 px-3 py-1 rounded-full inline-block">
                          {model.symbol.toUpperCase()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 bg-green-50 px-3 py-1 rounded-full inline-block">
                          {model.time_horizon}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {model.final_pnl >= 0 ? (
                            <div className="flex items-center space-x-2">
                              <TrendingUp className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                                {formatPercentage(model.final_pnl)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <TrendingDown className="w-4 h-4 text-red-600" />
                              <span className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                                {formatPercentage(model.final_pnl)}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sortedModels.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Brain className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm || filterExchange !== 'all' || filterSymbol !== 'all' || filterTimeframe !== 'all'
                    ? 'No models match your filters' 
                    : 'No models found'}
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  {searchTerm || filterExchange !== 'all' || filterSymbol !== 'all' || filterTimeframe !== 'all'
                    ? 'Try adjusting your search or filter criteria to find matching models.'
                    : 'No ML models are currently configured in the database.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Card View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentRecords.map((model) => (
              <div 
                key={model.id}
                className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
                onClick={() => handleModelClick(model)}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">{model.model_name}</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Exchange</span>
                    <span className="text-sm font-medium text-gray-900 bg-gray-50 px-2 py-1 rounded">
                      {model.exchange.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Symbol</span>
                    <span className="text-sm font-medium text-gray-900 bg-blue-50 px-2 py-1 rounded">
                      {model.symbol.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Timeframe</span>
                    <span className="text-sm font-medium text-gray-900 bg-green-50 px-2 py-1 rounded">
                      {model.time_horizon}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm text-gray-600">P&L</span>
                    <div className="flex items-center space-x-1">
                      {model.final_pnl >= 0 ? (
                        <>
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-bold text-green-600">
                            {formatPercentage(model.final_pnl)}
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-bold text-red-600">
                            {formatPercentage(model.final_pnl)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Enhanced Pagination */}
        {sortedModels.length > 0 && totalPages > 1 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6 mt-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium text-purple-600">{indexOfFirstRecord + 1}</span> to <span className="font-medium text-purple-600">{Math.min(indexOfLastRecord, sortedModels.length)}</span> of <span className="font-medium text-purple-600">{sortedModels.length}</span> results
                </div>
              
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 border border-gray-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>
                  
                  <div className="flex items-center space-x-1">
                  {renderPageNumbers()}
                  </div>
                  
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 border border-gray-200"
                  >
                    <span>Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}

// Home Component
function Home() {
  const [stats, setStats] = useState({ strategyCount: 0, modelCount: 0, profitableStrategies: 0 });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const fetchRealtimeStats = useCallback(async () => {
    try {
      setStatsError(null);
      const [strategiesRes, modelsRes] = await Promise.all([
        axios.get('/api/strategies'),
        axios.get('/api/models')
      ]);

      const strategies = (strategiesRes.data && strategiesRes.data.data) || [];
      const models = (modelsRes.data && (modelsRes.data.data || modelsRes.data)) || [];
      const profitable = strategies.filter((s) => (s.performance?.profitLoss ?? 0) > 0).length;

      setStats({
        strategyCount: strategies.length,
        modelCount: models.length,
        profitableStrategies: profitable
      });
      setLastUpdated(new Date());
    } catch (e) {
      setStatsError('Live stats unavailable. Please ensure the server is running.');
      // still set timestamp to indicate attempted refresh
      setLastUpdated(new Date());
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    fetchRealtimeStats();
    const intervalId = setInterval(fetchRealtimeStats, 30000);
    return () => clearInterval(intervalId);
  }, [fetchRealtimeStats]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-white">
      <Header activePage="home" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl shadow-xl ring-1 ring-blue-100/60 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <div className="absolute inset-0 opacity-30" style={{backgroundImage:'radial-gradient(800px 200px at 10% 20%, rgba(147,197,253,0.25) 0, transparent 60%), radial-gradient(600px 200px at 90% 30%, rgba(196,181,253,0.25) 0, transparent 60%), radial-gradient(600px 200px at 50% 90%, rgba(110,231,183,0.15) 0, transparent 60%)'}} />
          <div className="relative px-6 py-14 sm:px-12 sm:py-16 lg:px-16">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                Intelligent crypto signals. Professional execution.
              </h1>
              <p className="mt-4 text-base sm:text-lg text-white/80 max-w-3xl mx-auto">
                Discover top-performing strategies, compare AI models, and connect your exchange for end‑to‑end, signal‑driven trading.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/simulator" className="px-6 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-blue-50 transition-all shadow">
                  Explore Simulator
                </Link>
                <Link to="/models" className="px-6 py-3 rounded-xl bg-white/10 text-white font-semibold border border-white/20 hover:bg-white/20 transition-all shadow">
                  Browse ML Models
                </Link>
                <button onClick={() => window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode: 'signup' } }))} className="px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-all shadow">
                  Get Started
                </button>
              </div>
            </div>
            {/* Stats */}
            <div className="mt-10">
              {statsError && (<div className="text-xs text-red-200 mb-3 text-center">{statsError}</div>)}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-5 text-white">
                  <div className="text-xs uppercase tracking-wide text-white/80">Strategies</div>
                  <div className="mt-1 text-2xl font-extrabold">{stats.strategyCount}</div>
                  <div className="mt-1 text-xs text-white/70">Total strategies tracked</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-5 text-white">
                  <div className="text-xs uppercase tracking-wide text-white/80">Profitable</div>
                  <div className="mt-1 text-2xl font-extrabold text-emerald-300">{stats.profitableStrategies}</div>
                  <div className="mt-1 text-xs text-white/70">Strategies with positive P&L</div>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-5 text-white">
                  <div className="text-xs uppercase tracking-wide text-white/80">Models</div>
                  <div className="mt-1 text-2xl font-extrabold">{stats.modelCount}</div>
                  <div className="mt-1 text-xs text-white/70">ML models available</div>
                </div>
              </div>
            </div>
            {/* Pill features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              <div className="text-center">
                <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 text-white"><BarChart3 className="w-6 h-6" /></div>
                <h3 className="text-sm font-semibold text-white mb-1">Strategy Analytics</h3>
                <p className="text-xs text-white/80">Filter, sort, and drill into P&L and behavior</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 text-white"><Brain className="w-6 h-6" /></div>
                <h3 className="text-sm font-semibold text-white mb-1">ML Insights</h3>
                <p className="text-xs text-white/80">Compare models, horizons, symbols, exchanges</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 text-white"><Users className="w-6 h-6" /></div>
                <h3 className="text-sm font-semibold text-white mb-1">Operational Control</h3>
                <p className="text-xs text-white/80">Manage users, access, and settings</p>
              </div>
            </div>
          </div>
        </section>

        {/* Highlights */}
        <section className="mt-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-xl font-bold text-gray-900">Highlights</h2>
            <div className="h-px flex-1 ml-6 bg-gradient-to-r from-gray-200 to-transparent" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900">What you can do</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-blue-500"></span><span>Inspect strategies with sortable, paginated analytics</span></li>
                <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-blue-500"></span><span>Slice by exchange, symbol, timeframe</span></li>
                <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-blue-500"></span><span>Open deep-dive detail pages instantly</span></li>
              </ul>
            </div>
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900">Model analytics</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-indigo-500"></span><span>Compare ML models by P&L and stability</span></li>
                <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-indigo-500"></span><span>Toggle table and card views for scanning</span></li>
                <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-indigo-500"></span><span>Focus on specific assets and horizons</span></li>
              </ul>
            </div>
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900">Administration</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-cyan-500"></span><span>Manage users and roles securely</span></li>
                <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-cyan-500"></span><span>Align access with operational processes</span></li>
                <li className="flex items-start gap-2"><span className="mt-1 h-2 w-2 rounded-full bg-cyan-500"></span><span>Keep data access auditable and organized</span></li>
              </ul>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-12 bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 text-center">How it works</h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl ring-1 ring-gray-200 p-6">
              <div className="text-sm font-semibold text-blue-700">1) See strategies by market</div>
              <p className="mt-2 text-sm text-gray-700">Browse strategies by exchange, symbol, and horizon that fit your schedule.</p>
            </div>
            <div className="rounded-2xl ring-1 ring-gray-200 p-6">
              <div className="text-sm font-semibold text-blue-700">2) Pick by P&L or enable AI</div>
              <p className="mt-2 text-sm text-gray-700">Select top performers using P&L and stability. Optionally enable AI models.</p>
            </div>
            <div className="rounded-2xl ring-1 ring-gray-200 p-6">
              <div className="text-sm font-semibold text-blue-700">3) Connect and go</div>
              <p className="mt-2 text-sm text-gray-700">Add your exchange API keys—signals and execution are handled end to end.</p>
            </div>
          </div>
        </section>

        {/* Quick Start + Designed For */}
        <section className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900">Quick start</h2>
            <ol className="mt-4 space-y-4 text-sm text-gray-700">
              <li className="flex gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-blue-600"></span><span>Open the <Link to="/simulator" className="text-blue-600 hover:text-blue-800 font-medium">Simulator</Link> and set exchange, symbol, timeframe.</span></li>
              <li className="flex gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-blue-600"></span><span>Sort by P&L to find top performers and open details.</span></li>
              <li className="flex gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-blue-600"></span><span>Need stronger signals? Visit <Link to="/models" className="text-blue-600 hover:text-blue-800 font-medium">Models</Link> and enable AI.</span></li>
              <li className="flex gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-blue-600"></span><span>Connect your exchange and execute with confidence.</span></li>
            </ol>
          </div>
          <div className="bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900">Designed for</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
              <div className="rounded-xl ring-1 ring-gray-200 p-4"><div className="font-semibold text-gray-900">New traders</div><p className="mt-1">Skip complexity. Use ranked strategies and AI for actionable signals.</p></div>
              <div className="rounded-xl ring-1 ring-gray-200 p-4"><div className="font-semibold text-gray-900">Busy professionals</div><p className="mt-1">Spend minutes. Filter quickly and act on the best options.</p></div>
              <div className="rounded-xl ring-1 ring-gray-200 p-4"><div className="font-semibold text-gray-900">Signal-first workflows</div><p className="mt-1">Generate and review signals in one place consistent layouts.</p></div>
              <div className="rounded-xl ring-1 ring-gray-200 p-4"><div className="font-semibold text-gray-900">Confidence and clarity</div><p className="mt-1">Clear P&L and details help you decide without guesswork.</p></div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-12 bg-white rounded-3xl shadow-sm ring-1 ring-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900">FAQ</h2>
          <div className="mt-4 divide-y divide-gray-200">
            <details className="py-4 group">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                Are my API keys and credentials safe?
                <span className="text-blue-600 text-sm group-open:hidden">Show</span>
                <span className="text-blue-600 text-sm hidden group-open:inline">Hide</span>
              </summary>
              <p className="mt-2 text-sm text-gray-700">We only use your API key and secret to communicate with your exchange for signal execution. Keys are never shared with third parties.</p>
            </details>
            <details className="py-4 group">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                How are API keys stored and used?
                <span className="text-blue-600 text-sm group-open:hidden">Show</span>
                <span className="text-blue-600 text-sm hidden group-open:inline">Hide</span>
              </summary>
              <p className="mt-2 text-sm text-gray-700">Keys are stored server-side and used only to place authenticated requests to your exchange based on your selected strategies/models.</p>
            </details>
            <details className="py-4 group">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                What permissions should I grant?
                <span className="text-blue-600 text-sm group-open:hidden">Show</span>
                <span className="text-blue-600 text-sm hidden group-open:inline">Hide</span>
              </summary>
              <p className="mt-2 text-sm text-gray-700">Grant trade permissions only. Do not enable withdrawal access on your exchange API keys.</p>
            </details>
            <details className="py-4 group">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                Can I revoke access at any time?
                <span className="text-blue-600 text-sm group-open:hidden">Show</span>
                <span className="text-blue-600 text-sm hidden group-open:inline">Hide</span>
              </summary>
              <p className="mt-2 text-sm text-gray-700">Yes. Delete or disable your API key on the exchange dashboard to immediately revoke access.</p>
            </details>
            <details className="py-4 group">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                Do you place trades automatically?
                <span className="text-blue-600 text-sm group-open:hidden">Show</span>
                <span className="text-blue-600 text-sm hidden group-open:inline">Hide</span>
              </summary>
              <p className="mt-2 text-sm text-gray-700">Signals are generated by your selected strategies or AI models. If execution is enabled with valid API keys, orders can be placed automatically according to those signals.</p>
            </details>
            <details className="py-4 group">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                What are the costs or fees?
                <span className="text-blue-600 text-sm group-open:hidden">Show</span>
                <span className="text-blue-600 text-sm hidden group-open:inline">Hide</span>
              </summary>
              <p className="mt-2 text-sm text-gray-700">You pay your normal exchange fees. Platform pricing, if applicable, is shown during onboarding or billing.</p>
            </details>
            <details className="py-4 group">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                What data do you collect?
                <span className="text-blue-600 text-sm group-open:hidden">Show</span>
                <span className="text-blue-600 text-sm hidden group-open:inline">Hide</span>
              </summary>
              <p className="mt-2 text-sm text-gray-700">We collect strategy/model performance and operational metadata to improve reliability. We do not sell your data.</p>
            </details>
            <details className="py-4 group">
              <summary className="cursor-pointer font-semibold text-gray-900 flex items-center justify-between">
                How can I get support?
                <span className="text-blue-600 text-sm group-open:hidden">Show</span>
                <span className="text-blue-600 text-sm hidden group-open:inline">Hide</span>
              </summary>
              <p className="mt-2 text-sm text-gray-700">Contact support from the platform or email us. Provide your exchange and symbol/timeframe to speed up troubleshooting.</p>
            </details>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-12 relative overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600" />
          <div className="relative p-8 sm:p-10 text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Start exploring strategies and models</h2>
            <p className="mt-2 text-white/90 max-w-2xl mx-auto text-sm sm:text-base">Open the simulator or browse ML models. When ready, connect your exchange and execute with confidence.</p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/simulator" className="px-5 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-blue-50 transition-all shadow">Open Simulator</Link>
              <Link to="/models" className="px-5 py-3 rounded-xl bg-white/10 text-white font-semibold border border-white/20 hover:bg-white/20 transition-all shadow">Browse ML Models</Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// Strategy Detail Component with Router
function StrategyDetailWithRouter() {
  const { strategyName } = useParams();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/simulator');
  };

  return <StrategyDetail strategyName={strategyName} onBack={handleBack} />;
}

// User Management Component with Router
function UserManagementWithRouter() {
  return <UserManagement />;
}

// Model Detail Component with Router
function ModelDetailWithRouter() {
  const { tableName } = useParams();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/models');
  };

  return <ModelDetail tableName={tableName} onBack={handleBack} />;
}

// Main App Component
function App() {
  return (
    <AuthProvider>
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
          <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
        <Route path="/simulator" element={<StrategyList />} />
        <Route path="/strategy/:strategyName" element={<StrategyDetailWithRouter />} />
        <Route path="/user-management" element={<UserManagementWithRouter />} />
        <Route path="/models" element={<ModelsList />} />
        <Route path="/model/:tableName" element={<ModelDetailWithRouter />} />
      </Routes>
        <AuthModal />
    </Router>
    </AuthProvider>
  );
}

export default App;
