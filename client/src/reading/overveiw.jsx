import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpenIcon,
  TrophyIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
  PlusIcon,
  EyeIcon,
  XMarkIcon,
  CalendarIcon,
  StarIcon,
  DocumentTextIcon,
  PlayIcon,
  ArrowLeftIcon,
  SparklesIcon,
  FireIcon,
  BoltIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  HeartIcon
} from '@heroicons/react/24/outline';

const Overview = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    overview: { total: 0, completed: 0, inProgress: 0, overdue: 0 },
    upcomingDeadlines: [],
    topGenres: [],
    recentActivity: { booksAddedThisMonth: 0, booksCompletedThisMonth: 0 }
  });
  const [recentBooks, setRecentBooks] = useState([]);
  const [pagesRead, setPagesRead] = useState(0);

  // Modal states
  const [showBookModal, setShowBookModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showAllBooksModal, setShowAllBooksModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);

  // All books modal state
  const [allBooks, setAllBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [allBooksLoading, setAllBooksLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');

  // Get status info helper
  const getStatusInfo = (status) => {
    const statusInfo = {
      to_read: { color: 'gray', label: 'To Read', icon: ClockIcon },
      reading: { color: 'blue', label: 'Reading', icon: PlayIcon },
      completed: { color: 'green', label: 'Completed', icon: CheckCircleIcon },
      on_hold: { color: 'yellow', label: 'On Hold', icon: ExclamationTriangleIcon }
    };
    return statusInfo[status] || statusInfo.to_read;
  };

  // Get rating stars
  const getRatingStars = (rating) => {
    if (!rating) return null;
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map(star => (
          <StarIcon 
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
          />
        ))}
        <span className="text-xs text-gray-500 ml-1">({rating})</span>
      </div>
    );
  };

  // Calculate total pages read
  const calculatePagesRead = (readings) => {
    let totalPages = 0;
    readings.forEach(reading => {
      if (reading.status === 'completed' && reading.totalPages) {
        totalPages += reading.totalPages;
      }
    });
    return totalPages;
  };

  // Load dashboard stats
  const loadStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:5001/api/reading/stats/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (response.ok) {
        const dashboardData = await response.json();
        console.log('✅ Reading dashboard stats loaded:', dashboardData);
        
        // Map the backend response to your frontend state structure
        setStats({
          overview: {
            total: dashboardData.overview.total || 0,
            completed: dashboardData.overview.completed || 0,
            inProgress: dashboardData.overview.currentlyReading || 0,
            overdue: dashboardData.upcomingDeadlines?.filter(item => 
              new Date(item.targetDate) < new Date()
            ).length || 0
          },
          upcomingDeadlines: dashboardData.upcomingDeadlines || [],
          topGenres: dashboardData.trends?.genres?.map(genre => ({
            genre: genre._id,
            count: genre.totalCount
          })) || [],
          recentActivity: {
            booksAddedThisMonth: dashboardData.overview.thisMonth || 0,
            booksCompletedThisMonth: dashboardData.overview.booksThisMonth || 0
          }
        });
        
        // Set total pages read
        setPagesRead(dashboardData.overview.bookPagesRead || 0);
      } else {
        console.error('Failed to load reading stats');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading reading stats:', error);
      setLoading(false);
    }
  };

  // Load recent books
  const loadRecentBooks = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      // Load all reading items to calculate total pages read
      const allResponse = await fetch('http://localhost:5001/api/reading?limit=1000&type=book', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (allResponse.ok) {
        const allData = await allResponse.json();
        const totalPages = calculatePagesRead(allData.readings || []);
        setPagesRead(totalPages);
      }

      // Load recent books for display
      const recentResponse = await fetch('http://localhost:5001/api/reading?limit=8&sortBy=updatedAt&sortOrder=desc&type=book', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (recentResponse.ok) {
        const recentData = await recentResponse.json();
        console.log('✅ Recent books loaded:', recentData.readings.length);
        
        // Transform reading items to match your component structure
        const transformedBooks = recentData.readings.map(reading => ({
          _id: reading._id,
          title: reading.title,
          author: reading.author,
          status: reading.status,
          pages: reading.totalPages,
          currentPage: reading.currentPage,
          rating: reading.rating,
          genre: reading.genre,
          dateStarted: reading.startedAt,
          dateCompleted: reading.completedAt,
          notes: reading.notes ? [{ content: reading.notes, createdAt: reading.updatedAt }] : [],
          progress: reading.progress || 0
        }));
        
        setRecentBooks(transformedBooks);
      }
    } catch (error) {
      console.error('Error loading recent books:', error);
    }
  };

  // Load all books for the modal
  const loadAllBooks = async () => {
    try {
      setAllBooksLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch('http://localhost:5001/api/reading?limit=1000&type=book&sortBy=createdAt&sortOrder=desc', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ All books loaded:', data.readings.length);
        
        // Transform reading items to match your component structure
        const transformedBooks = data.readings.map(reading => ({
          _id: reading._id,
          title: reading.title,
          author: reading.author,
          status: reading.status,
          pages: reading.totalPages,
          currentPage: reading.currentPage,
          rating: reading.rating,
          genre: reading.genre,
          dateStarted: reading.startedAt,
          dateCompleted: reading.completedAt,
          notes: reading.notes ? [{ content: reading.notes, createdAt: reading.updatedAt }] : [],
          progress: reading.progress || 0
        }));
        
        setAllBooks(transformedBooks);
        setFilteredBooks(transformedBooks);
      }
      
      setAllBooksLoading(false);
    } catch (error) {
      console.error('Error loading all books:', error);
      setAllBooksLoading(false);
    }
  };

  // Filter books based on search and filters
  const filterBooks = () => {
    let filtered = [...allBooks];

    // Search filter
    if (searchTerm.trim()) {
      filtered = filtered.filter(book => 
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(book => book.status === statusFilter);
    }

    // Genre filter
    if (genreFilter !== 'all') {
      filtered = filtered.filter(book => book.genre === genreFilter);
    }

    // Rating filter
    if (ratingFilter !== 'all') {
      if (ratingFilter === 'unrated') {
        filtered = filtered.filter(book => !book.rating);
      } else {
        filtered = filtered.filter(book => book.rating >= parseInt(ratingFilter));
      }
    }

    setFilteredBooks(filtered);
  };

  // Load book details
  const loadBookDetails = async (bookId) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`http://localhost:5001/api/reading/${bookId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const reading = await response.json();
        console.log('✅ Book details loaded:', reading.title);
        
        // Transform to match your component structure
        const transformedBook = {
          _id: reading._id,
          title: reading.title,
          author: reading.author,
          status: reading.status,
          pages: reading.totalPages,
          currentPage: reading.currentPage,
          rating: reading.rating,
          genre: reading.genre,
          dateStarted: reading.startedAt,
          dateCompleted: reading.completedAt,
          notes: reading.notes ? [{ content: reading.notes, createdAt: reading.updatedAt }] : [],
          progress: reading.progress || 0,
          analytics: reading.analytics
        };
        
        setSelectedBook(transformedBook);
        setShowBookModal(true);
        setShowAllBooksModal(false);
      } else {
        console.error('❌ Failed to load book details:', response.status);
        // Fallback to local data if API fails
        const book = allBooks.find(b => b._id === bookId) || recentBooks.find(b => b._id === bookId);
        if (book) {
          setSelectedBook(book);
          setShowBookModal(true);
          setShowAllBooksModal(false);
        }
      }
    } catch (error) {
      console.error('Error loading book details:', error);
      // Fallback to local data
      const book = allBooks.find(b => b._id === bookId) || recentBooks.find(b => b._id === bookId);
      if (book) {
        setSelectedBook(book);
        setShowBookModal(true);
        setShowAllBooksModal(false);
      }
    }
  };

  // Open note modal
  const openNoteModal = (note) => {
    setSelectedNote(note);
    setShowNoteModal(true);
  };

  // Open all books modal
  const openAllBooksModal = () => {
    setShowAllBooksModal(true);
    loadAllBooks();
  };

  // Calculate reading progress
  const calculateProgress = (book) => {
    if (!book.pages || book.pages === 0) return 0;
    return Math.round((book.currentPage / book.pages) * 100);
  };

  // Get unique genres and ratings for filters
  const getUniqueGenres = () => {
    const genres = [...new Set(allBooks.map(book => book.genre))];
    return genres.sort();
  };

  // Apply filters whenever dependencies change
  useEffect(() => {
    filterBooks();
  }, [searchTerm, statusFilter, genreFilter, ratingFilter, allBooks]);

  useEffect(() => {
    loadStats();
    loadRecentBooks();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const completionRate = stats.overview.total > 0 
    ? ((stats.overview.completed / stats.overview.total) * 100).toFixed(1)
    : 0;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <BookOpenIcon className="w-6 h-6 text-white" />
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Books</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.overview.total}</p>
            <div className="mt-3 text-sm text-gray-600">
              {stats.recentActivity.booksAddedThisMonth} added this month
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <TrophyIcon className="w-6 h-6 text-white" />
              </div>
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Completed</h3>
            <p className="text-3xl font-bold text-green-600">{stats.overview.completed}</p>
            <div className="mt-3 text-sm text-gray-600">
              {stats.recentActivity.booksCompletedThisMonth} finished this month
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-white" />
              </div>
              <ArrowTrendingUpIcon className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Currently Reading</h3>
            <p className="text-3xl font-bold text-orange-600">{stats.overview.inProgress}</p>
            <div className="mt-3 text-sm text-gray-600">
              Active reads
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <DocumentTextIcon className="w-6 h-6 text-white" />
              </div>
              <BookOpenIcon className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Completion Rate</h3>
            <p className="text-3xl font-bold text-purple-600">{completionRate}%</p>
            <div className="mt-3 text-sm text-gray-600">
              {stats.overview.overdue} book{stats.overview.overdue !== 1 ? 's' : ''} on hold
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Genres */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Genres</h3>
            <div className="space-y-4">
              {stats.topGenres.map((genre, index) => (
                <div key={genre.genre} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      index === 0 ? 'bg-blue-500' : 
                      index === 1 ? 'bg-green-500' : 
                      index === 2 ? 'bg-orange-500' : 
                      'bg-gray-400'
                    }`}></div>
                    <span className="font-medium text-gray-900 capitalize">
                      {genre.genre}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          index === 0 ? 'bg-blue-500' : 
                          index === 1 ? 'bg-green-500' : 
                          index === 2 ? 'bg-orange-500' : 
                          'bg-gray-400'
                        }`}
                        style={{
                          width: `${(genre.count / Math.max(...stats.topGenres.map(c => c.count))) * 100}%`
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-600 w-8 text-right">
                      {genre.count}
                    </span>
                  </div>
                </div>
              ))}
              {stats.topGenres.length === 0 && (
                <p className="text-gray-500 text-center py-4">No genres yet</p>
              )}
            </div>
          </div>

          {/* Recent Books - Clickable Cards */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Books</h3>
              <button
                onClick={openAllBooksModal}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All
              </button>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {recentBooks.map((book) => {
                const statusInfo = getStatusInfo(book.status);
                const StatusIcon = statusInfo.icon;
                const progress = calculateProgress(book);
                
                return (
                  <div 
                    key={book._id} 
                    onClick={() => loadBookDetails(book._id)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <StatusIcon className={`w-4 h-4 text-${statusInfo.color}-500`} />
                        <h4 className="font-medium text-gray-900 text-sm truncate">{book.title}</h4>
                      </div>
                      <div className="flex items-center space-x-3 mb-1">
                        <span className="text-xs text-gray-500">{book.author}</span>
                        <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                          {book.genre}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3">
                        {book.status === 'reading' && (
                          <div className="flex items-center space-x-1">
                            <div className="w-12 bg-gray-200 rounded-full h-1">
                              <div 
                                className={`h-1 bg-${statusInfo.color}-500 rounded-full`}
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500">{progress}%</span>
                          </div>
                        )}
                        {book.rating && (
                          <div className="flex items-center">
                            <StarIcon className="w-3 h-3 text-yellow-400 fill-current" />
                            <span className="text-xs text-gray-500 ml-1">{book.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button className="p-1 text-gray-400 hover:text-blue-600 transition-colors">
                      <EyeIcon className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {recentBooks.length === 0 && (
                <div className="text-center py-8">
                  <BookOpenIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No books yet</p>
                  <button
                    onClick={() => navigate('/reading/add')}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Add your first book
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reading Journey Insights */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Your Reading Journey</h3>
            <SparklesIcon className="w-6 h-6" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <DocumentTextIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Pages Read</h4>
                  <p className="text-sm opacity-90">Total pages completed</p>
                </div>
              </div>
              <p className="text-2xl font-bold">{pagesRead.toLocaleString()}</p>
            </div>

            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <BoltIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Monthly Progress</h4>
                  <p className="text-sm opacity-90">Books finished this month</p>
                </div>
              </div>
              <p className="text-2xl font-bold">{stats.recentActivity.booksCompletedThisMonth}</p>
            </div>

            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <TrophyIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold">Completion Rate</h4>
                  <p className="text-sm opacity-90">Books finished vs started</p>
                </div>
              </div>
              <p className="text-2xl font-bold">{completionRate}%</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/20">
            <div>
              <h4 className="font-semibold mb-1">Keep Reading! 📚</h4>
              <p className="text-sm opacity-90">
                {pagesRead > 0 
                  ? `Fantastic! You've read ${pagesRead.toLocaleString()} pages across your books. ${
                      stats.overview.inProgress > 0 
                        ? `${stats.overview.inProgress} book${stats.overview.inProgress !== 1 ? 's' : ''} currently in progress!`
                        : 'Ready for your next book?'
                    }`
                  : stats.overview.total > 0
                  ? "You have books in your library! Start reading to track your progress."
                  : "Ready to start your reading journey? Add your first book today!"
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* All Books Modal */}
      {showAllBooksModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">All Books</h3>
                <button
                  onClick={() => setShowAllBooksModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Search and Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="relative">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search books..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="to_read">To Read</option>
                  <option value="reading">Reading</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>

                {/* Genre Filter */}
                <select
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Genres</option>
                  {getUniqueGenres().map(genre => (
                    <option key={genre} value={genre} className="capitalize">
                      {genre}
                    </option>
                  ))}
                </select>

                {/* Rating Filter */}
                <select
                  value={ratingFilter}
                  onChange={(e) => setRatingFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4+ Stars</option>
                  <option value="3">3+ Stars</option>
                  <option value="unrated">Unrated</option>
                </select>
              </div>

              {/* Results count */}
              <div className="mt-4 text-sm text-gray-600">
                Showing {filteredBooks.length} of {allBooks.length} books
              </div>
            </div>

            {/* Books List */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {allBooksLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              ) : filteredBooks.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredBooks.map((book) => {
                    const statusInfo = getStatusInfo(book.status);
                    const StatusIcon = statusInfo.icon;
                    const progress = calculateProgress(book);
                    
                    return (
                      <div
                        key={book._id}
                        onClick={() => loadBookDetails(book._id)}
                        className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 cursor-pointer transition-colors border"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <StatusIcon className={`w-4 h-4 text-${statusInfo.color}-500`} />
                            <span className={`text-xs px-2 py-1 rounded-full text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          {book.rating && getRatingStars(book.rating)}
                        </div>
                        
                        <h4 className="font-semibold text-gray-900 mb-1 line-clamp-2">
                          {book.title}
                        </h4>
                        
                        <p className="text-sm text-gray-600 mb-3">
                          by {book.author}
                        </p>
                        
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded-full">
                            {book.genre}
                          </span>
                          
                          {book.status === 'reading' && (
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className={`h-1.5 bg-${statusInfo.color}-500 rounded-full`}
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-gray-500">{progress}%</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          {book.pages} pages
                          {book.currentPage > 0 && book.status !== 'completed' && (
                            <span> • Page {book.currentPage}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-20">
                  <BookOpenIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No books found</h4>
                  <p className="text-gray-500">
                    {searchTerm || statusFilter !== 'all' || genreFilter !== 'all' || ratingFilter !== 'all'
                      ? 'Try adjusting your filters or search term.'
                      : 'Add your first book to get started!'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Book Details Modal */}
      {showBookModal && selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Book Details</h3>
                <button
                  onClick={() => { setShowBookModal(false); setSelectedBook(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Book Info */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900 mb-1">{selectedBook.title}</h4>
                    <p className="text-gray-600 mb-4">by {selectedBook.author}</p>
                    
                    <div className="flex flex-wrap gap-3 mb-4">
                      {(() => {
                        const statusInfo = getStatusInfo(selectedBook.status);
                        return (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                            {statusInfo.label}
                          </span>
                        );
                      })()}
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                        {selectedBook.genre}
                      </span>
                      {selectedBook.rating && (
                        <div className="flex items-center px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
                          {getRatingStars(selectedBook.rating)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Pages</label>
                      <p className="text-gray-900">{selectedBook.pages}</p>
                    </div>
                    {selectedBook.status === 'reading' && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Current Page</label>
                        <p className="text-gray-900">{selectedBook.currentPage}</p>
                      </div>
                    )}
                  </div>

                  {selectedBook.status === 'reading' && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Reading Progress</label>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-blue-500 h-3 rounded-full"
                          style={{ width: `${calculateProgress(selectedBook)}%` }}
                        ></div>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {calculateProgress(selectedBook)}% complete
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    {selectedBook.dateStarted && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Started</label>
                        <p className="text-gray-900">{new Date(selectedBook.dateStarted).toLocaleDateString()}</p>
                      </div>
                    )}
                    {selectedBook.dateCompleted && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Completed</label>
                        <p className="text-gray-900">{new Date(selectedBook.dateCompleted).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Notes */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-lg font-semibold text-gray-900">Notes</h5>
                    <span className="text-sm text-gray-500">
                      {selectedBook.notes?.length || 0} note{(selectedBook.notes?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedBook.notes && selectedBook.notes.length > 0 ? (
                      selectedBook.notes.map((note, index) => (
                        <div
                          key={index}
                          className="p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                          onClick={() => openNoteModal(note)}
                        >
                          <p className="text-sm text-gray-700 line-clamp-3">
                            {note.content}
                          </p>
                          <div className="mt-2 text-xs text-gray-500">
                            {new Date(note.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No notes yet</p>
                        <button className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                          Add your first note
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  onClick={() => { setShowBookModal(false); setSelectedBook(null); }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note Details Modal */}
      {showNoteModal && selectedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Reading Note</h3>
                <button
                  onClick={() => { setShowNoteModal(false); setSelectedNote(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <DocumentTextIcon className="w-5 h-5 text-blue-500" />
                    <h4 className="font-medium text-blue-900">Note</h4>
                  </div>
                  <p className="text-blue-800 whitespace-pre-wrap leading-relaxed">
                    {selectedNote.content}
                  </p>
                  <div className="mt-2 text-sm text-blue-600">
                    Created on {new Date(selectedNote.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="text-sm text-gray-500">
                  {selectedNote.content.trim().split(/\s+/).length} words
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  onClick={() => { setShowNoteModal(false); setSelectedNote(null); }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Overview;