import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  XMarkIcon,
  EyeIcon,
  PencilIcon,
  ArrowLeftIcon,
  BookOpenIcon,
  FireIcon,
  CalendarIcon,
  DocumentTextIcon,
  CubeIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
  StarIcon
} from '@heroicons/react/24/outline';

const SetProgress = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    genre: 'all',
    status: 'all',
    priority: 'all'
  });
  
  // Modal states
  const [showChapterModal, setShowChapterModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [chapterSummary, setChapterSummary] = useState('');
  const [chapterNotes, setChapterNotes] = useState('');
  const [readingTime, setReadingTime] = useState('');
  const [currentPage, setCurrentPage] = useState('');
  const [sessionDuration, setSessionDuration] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [pagesRead, setPagesRead] = useState('');
  const [startPage, setStartPage] = useState('');
  const [endPage, setEndPage] = useState('');

  const genres = [
    'fiction', 'non-fiction', 'biography', 'business', 'self-help', 'science',
    'history', 'philosophy', 'technology', 'health', 'education', 'thriller',
    'romance', 'fantasy', 'mystery', 'psychology', 'economics', 'politics',
    'religion', 'art', 'other'
  ];
  const statuses = ['to_read', 'reading', 'completed', 'on_hold', 'abandoned'];
  const priorities = ['low', 'medium', 'high'];

  // Status info helper
  const getStatusInfo = (status) => {
    const statusInfo = {
      to_read: { color: 'gray', label: 'To Read', icon: ClockIcon },
      reading: { color: 'blue', label: 'Reading', icon: PlayIcon },
      on_hold: { color: 'yellow', label: 'On Hold', icon: PauseIcon },
      completed: { color: 'green', label: 'Completed', icon: CheckCircleIcon },
      abandoned: { color: 'red', label: 'Abandoned', icon: XMarkIcon }
    };
    return statusInfo[status] || statusInfo.to_read;
  };

  // Priority info helper
  const getPriorityInfo = (priority) => {
    const priorityColors = {
      low: 'bg-gray-100 text-gray-600',
      medium: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600'
    };
    return priorityColors[priority] || priorityColors.medium;
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
      </div>
    );
  };

  // Load books data
  const loadBooksData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const params = new URLSearchParams({
        limit: '100',
        type: 'book' // Only load books
      });

      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.genre !== 'all') {
        params.append('genre', filters.genre);
      }
      if (filters.priority !== 'all') {
        params.append('priority', filters.priority);
      }

      const response = await fetch(`http://localhost:5001/api/reading?${params}`, {
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
        const data = await response.json();
        // Filter books that are being read or have progress
        const activeBooks = (data.readings || []).filter(book => 
          book.status === 'reading' || book.status === 'to_read' || book.currentPage > 0
        );
        setBooks(activeBooks);
        setFilteredBooks(activeBooks);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading books data:', error);
      setLoading(false);
    }
  };

  // Filter books based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredBooks(books);
    } else {
      const filtered = books.filter(book =>
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.genre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (book.tags && book.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      );
      setFilteredBooks(filtered);
    }
  }, [searchTerm, books]);

  // Load specific book with full details
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
        const bookData = await response.json();
        setSelectedBook(bookData);
      } else {
        console.error('Failed to load book details');
      }
    } catch (error) {
      console.error('Error loading book details:', error);
    }
  };

  // Update reading progress
  const handleUpdateProgress = async (bookId, progressData) => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`http://localhost:5001/api/reading/${bookId}/progress`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(progressData)
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the books in state
        const updatedBooks = books.map(book => 
          book._id === bookId ? { ...book, ...data } : book
        );
        setBooks(updatedBooks);
        setFilteredBooks(updatedBooks);
        
        // Update selected book
        setSelectedBook(data);
        
        console.log('✅ Progress updated successfully');
        return true;
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update progress');
        return false;
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      alert('Network error. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Log reading session
  const handleLogSession = async (bookId, sessionData) => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`http://localhost:5001/api/reading/${bookId}/session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sessionData)
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the books in state
        const updatedBooks = books.map(book => 
          book._id === bookId ? { ...book, currentPage: data.currentPage, status: data.status } : book
        );
        setBooks(updatedBooks);
        setFilteredBooks(updatedBooks);
        
        // Reload book details to get updated sessions
        loadBookDetails(bookId);
        
        console.log('✅ Session logged successfully');
        return true;
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to log session');
        return false;
      }
    } catch (error) {
      console.error('Error logging session:', error);
      alert('Network error. Please try again.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add chapter summary to notes
  const handleChapterComplete = async (bookId, chapterData) => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('accessToken');
      
      // Create a comprehensive chapter summary
      const chapterNote = `📖 CHAPTER COMPLETED\n\n` +
        `Chapter/Section: ${chapterData.chapterTitle || 'Chapter'}\n` +
        `Pages: ${chapterData.startPage || 'N/A'} - ${chapterData.endPage || 'N/A'}\n` +
        `Reading Time: ${chapterData.duration || 'N/A'} minutes\n` +
        `Date: ${new Date().toLocaleDateString()}\n\n` +
        `📝 SUMMARY:\n${chapterData.summary}\n\n` +
        `💭 NOTES:\n${chapterData.notes || 'No additional notes'}`;

      // Update progress with the session and notes
      const progressData = {
        currentPage: parseInt(chapterData.endPage) || selectedBook.currentPage,
        sessionDuration: parseInt(chapterData.duration) || undefined,
        notes: chapterNote
      };

      const success = await handleUpdateProgress(bookId, progressData);
      
      if (success) {
        setShowChapterModal(false);
        setSelectedChapter(null);
        resetForms();
        
        // Show success message
        alert(`✅ Chapter completed! Great progress on "${selectedBook.title}"`);
      }
    } catch (error) {
      console.error('Error completing chapter:', error);
      alert('Failed to complete chapter. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset forms
  const resetForms = () => {
    setChapterSummary('');
    setChapterNotes('');
    setReadingTime('');
    setCurrentPage('');
    setSessionDuration('');
    setSessionNotes('');
    setPagesRead('');
    setStartPage('');
    setEndPage('');
  };

  // Open modals
  const openChapterModal = (book) => {
    setSelectedBook(book);
    setSelectedChapter({ title: 'Current Chapter' });
    setStartPage(book.currentPage?.toString() || '0');
    setEndPage('');
    setReadingTime('');
    setChapterSummary('');
    setChapterNotes('');
    setShowChapterModal(true);
  };

  const openProgressModal = (book) => {
    setSelectedBook(book);
    setCurrentPage(book.currentPage?.toString() || '0');
    setSessionDuration('');
    setSessionNotes('');
    setShowProgressModal(true);
  };

  const openSessionModal = (book) => {
    setSelectedBook(book);
    setSessionDuration('');
    setPagesRead('');
    setStartPage(book.currentPage?.toString() || '0');
    setEndPage('');
    setSessionNotes('');
    setShowSessionModal(true);
  };

  const openSummaryModal = (book) => {
    setSelectedBook(book);
    setShowSummaryModal(true);
  };

  // Calculate reading progress
  const calculateProgress = (book) => {
    if (!book.totalPages || book.totalPages === 0) return 0;
    return Math.round((book.currentPage / book.totalPages) * 100);
  };

  // Check if book is overdue
  const isBookOverdue = (book) => {
    if (!book.targetDate || book.status === 'completed') return false;
    return new Date(book.targetDate) < new Date();
  };

  // Get book status color
  const getBookStatusColor = (book) => {
    if (book.status === 'completed') return 'green';
    if (isBookOverdue(book)) return 'red';
    if (book.targetDate) {
      const daysUntilDue = Math.ceil((new Date(book.targetDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue <= 7) return 'orange';
    }
    return 'blue';
  };

  useEffect(() => {
    loadBooksData();
  }, [filters]);

  // Auto-select first book when data loads
  useEffect(() => {
    if (filteredBooks.length > 0 && !selectedBook) {
      loadBookDetails(filteredBooks[0]._id);
    }
  }, [filteredBooks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header with Search */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Reading Progress</h2>
              <p className="text-gray-600">Track your reading sessions and complete chapters</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 lg:w-96">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search books..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-wrap gap-4">
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                </option>
              ))}
            </select>

            <select
              value={filters.genre}
              onChange={(e) => setFilters(prev => ({ ...prev, genre: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Genres</option>
              {genres.map(genre => (
                <option key={genre} value={genre}>{genre.charAt(0).toUpperCase() + genre.slice(1)}</option>
              ))}
            </select>

            <select
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Priorities</option>
              {priorities.map(priority => (
                <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>
              ))}
            </select>

            <div className="flex items-center space-x-2 px-3 py-2 bg-purple-50 rounded-lg">
              <BookOpenIcon className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">
                {filteredBooks.length} active book{filteredBooks.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Books List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Active Reading List</h3>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {filteredBooks.map(book => {
                const statusInfo = getStatusInfo(book.status);
                const StatusIcon = statusInfo.icon;
                const progress = calculateProgress(book);
                const isOverdue = isBookOverdue(book);

                return (
                  <div
                    key={book._id}
                    onClick={() => loadBookDetails(book._id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedBook && selectedBook._id === book._id ? 'bg-purple-50 border-r-4 border-purple-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">{book.title}</h4>
                          {isOverdue && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                              Overdue
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{book.author}</p>
                        {book.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">{book.description}</p>
                        )}
                      </div>
                      <div className="ml-3 flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {book.genre}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getPriorityInfo(book.priority)}`}>
                          {book.priority}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">{progress}%</div>
                        <div className="w-20 bg-gray-200 rounded-full h-1.5 mt-1">
                          <div 
                            className={`bg-${statusInfo.color}-500 h-1.5 rounded-full transition-all duration-300`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Reading Progress */}
                    {book.totalPages && (
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>Pages: {book.currentPage || 0} / {book.totalPages}</span>
                        <span>{book.totalPages - (book.currentPage || 0)} remaining</span>
                      </div>
                    )}

                    {/* Rating */}
                    {book.rating && (
                      <div className="flex items-center justify-between">
                        {getRatingStars(book.rating)}
                        <span className="text-xs text-gray-500">({book.rating}/5)</span>
                      </div>
                    )}

                    {book.targetDate && (
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        <span className={isOverdue ? 'text-red-600' : ''}>
                          Target: {new Date(book.targetDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredBooks.length === 0 && (
                <div className="p-12 text-center">
                  <BookOpenIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No active books</h3>
                  <p className="text-gray-600">
                    {searchTerm ? 'Try adjusting your search terms' : 'Start reading some books to track your progress'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Selected Book Progress */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedBook ? 'Reading Progress' : 'Select a Book'}
                </h3>
                {selectedBook && (
                  <button
                    onClick={() => setSelectedBook(null)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <ArrowLeftIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {selectedBook ? (
                <div className="p-6">
                  <div className="mb-6">
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">{selectedBook.title}</h4>
                    <p className="text-gray-600 mb-4">{selectedBook.author}</p>
                    
                    {selectedBook.description && (
                      <p className="text-gray-600 mb-4">{selectedBook.description}</p>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                            {selectedBook.genre}
                          </span>
                          <span className={`px-3 py-1 text-sm rounded-full ${getPriorityInfo(selectedBook.priority)}`}>
                            {selectedBook.priority}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-600">
                            {calculateProgress(selectedBook)}%
                          </div>
                          <div className="text-sm text-gray-500">Complete</div>
                        </div>
                      </div>
                    </div>

                    {/* Reading Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">
                          {selectedBook.currentPage || 0}
                        </div>
                        <div className="text-sm text-gray-500">Current Page</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-purple-600">
                          {selectedBook.totalPages ? (selectedBook.totalPages - (selectedBook.currentPage || 0)) : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">Pages Left</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-600">
                          {selectedBook.sessions ? selectedBook.sessions.length : 0}
                        </div>
                        <div className="text-sm text-gray-500">Sessions</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {selectedBook.totalPages && (
                      <div className="mb-6">
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                          <span>Reading Progress</span>
                          <span>{selectedBook.currentPage || 0} / {selectedBook.totalPages} pages</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-purple-500 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${calculateProgress(selectedBook)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <button
                        onClick={() => openChapterModal(selectedBook)}
                        className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-3 rounded-lg font-medium hover:from-purple-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2"
                      >
                        <CheckCircleIcon className="w-5 h-5" />
                        <span>Complete Chapter</span>
                      </button>
                      
                      <button
                        onClick={() => openSessionModal(selectedBook)}
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center justify-center space-x-2"
                      >
                        <FireIcon className="w-5 h-5" />
                        <span>Log Session</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <button
                        onClick={() => openProgressModal(selectedBook)}
                        className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200 flex items-center justify-center space-x-2"
                      >
                        <ChartBarIcon className="w-5 h-5" />
                        <span>Update Progress</span>
                      </button>
                      
                      <button
                        onClick={() => openSummaryModal(selectedBook)}
                        className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200 flex items-center justify-center space-x-2"
                      >
                        <DocumentTextIcon className="w-5 h-5" />
                        <span>View Notes</span>
                      </button>
                    </div>

                    {/* Recent Sessions */}
                    {selectedBook.sessions && selectedBook.sessions.length > 0 && (
                      <div>
                        <h5 className="text-lg font-medium text-gray-900 mb-3">Recent Sessions</h5>
                        <div className="space-y-2">
                          {selectedBook.sessions.slice(-3).reverse().map((session, index) => (
                            <div key={index} className="bg-gray-50 p-3 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(session.date).toLocaleDateString()}
                                </span>
                                <span className="text-sm text-gray-600">
                                  {session.duration} min
                                </span>
                              </div>
                              {session.pagesRead > 0 && (
                                <div className="text-sm text-gray-600">
                                  Read {session.pagesRead} pages
                                </div>
                              )}
                              {session.notes && (
                                <div className="text-sm text-gray-600 mt-1">
                                  {session.notes.length > 100 ? `${session.notes.substring(0, 100)}...` : session.notes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <BookOpenIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Book</h3>
                  <p className="text-gray-600">Choose a book from the list to track your reading progress</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chapter Completion Modal */}
      {showChapterModal && selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Complete Chapter</h3>
                <button
                  onClick={() => { 
                    setShowChapterModal(false); 
                    setSelectedChapter(null); 
                    resetForms();
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6">
                <div className="bg-purple-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium text-purple-900 mb-2">Book:</h4>
                  <p className="text-purple-800 font-medium">{selectedBook.title}</p>
                  <p className="text-purple-700 text-sm">{selectedBook.author}</p>
                </div>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (chapterSummary.trim().split(/\s+/).length < 50) {
                  alert('Please provide at least 50 words in your chapter summary.');
                  return;
                }
                handleChapterComplete(selectedBook._id, {
                  chapterTitle: selectedChapter?.title || 'Chapter',
                  startPage: startPage,
                  endPage: endPage,
                  duration: readingTime,
                  summary: chapterSummary,
                  notes: chapterNotes
                });
              }} className="space-y-4">
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Page</label>
                    <input
                      type="number"
                      min="0"
                      value={startPage}
                      onChange={(e) => setStartPage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Page *</label>
                    <input
                      type="number"
                      min="0"
                      value={endPage}
                      onChange={(e) => setEndPage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reading Time (min)</label>
                    <input
                      type="number"
                      min="1"
                      value={readingTime}
                      onChange={(e) => setReadingTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Chapter Summary *
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    value={chapterSummary}
                    onChange={(e) => setChapterSummary(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    rows="6"
                    placeholder="Summarize what you read in this chapter. Include key points, main ideas, characters, plot developments, or concepts learned. Minimum 50 words required."
                    required
                  />
                  <div className="mt-2 flex justify-between text-sm">
                    <span className={`${
                      chapterSummary.trim().split(/\s+/).length >= 50 
                        ? 'text-green-600' 
                        : chapterSummary.trim().split(/\s+/).filter(word => word.length > 0).length >= 30
                        ? 'text-orange-600'
                        : 'text-red-600'
                    }`}>
                      {chapterSummary.trim() ? chapterSummary.trim().split(/\s+/).filter(word => word.length > 0).length : 0} words
                      {chapterSummary.trim().split(/\s+/).filter(word => word.length > 0).length >= 50 && ' ✓'}
                    </span>
                    <span className="text-gray-500">Minimum 50 words required</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Additional Notes</label>
                  <textarea
                    value={chapterNotes}
                    onChange={(e) => setChapterNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    rows="3"
                    placeholder="Any additional thoughts, questions, or insights about this chapter..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { 
                      setShowChapterModal(false); 
                      setSelectedChapter(null); 
                      resetForms();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || chapterSummary.trim().split(/\s+/).filter(word => word.length > 0).length < 50}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Completing Chapter...' : 'Complete Chapter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Progress Update Modal */}
      {showProgressModal && selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Update Reading Progress</h3>
                <button
                  onClick={() => { 
                    setShowProgressModal(false); 
                    resetForms();
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const success = await handleUpdateProgress(selectedBook._id, {
                  currentPage: parseInt(currentPage),
                  sessionDuration: sessionDuration ? parseInt(sessionDuration) : undefined,
                  notes: sessionNotes.trim() || undefined
                });
                if (success) {
                  setShowProgressModal(false);
                  resetForms();
                }
              }} className="space-y-4">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Page *</label>
                  <input
                    type="number"
                    min="0"
                    max={selectedBook.totalPages || undefined}
                    value={currentPage}
                    onChange={(e) => setCurrentPage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  {selectedBook.totalPages && (
                    <p className="mt-1 text-sm text-gray-500">
                      Out of {selectedBook.totalPages} total pages
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Session Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Session Notes</label>
                  <textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Optional notes about this reading session..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { 
                      setShowProgressModal(false); 
                      resetForms();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating...' : 'Update Progress'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Session Logging Modal */}
      {showSessionModal && selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Log Reading Session</h3>
                <button
                  onClick={() => { 
                    setShowSessionModal(false); 
                    resetForms();
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const success = await handleLogSession(selectedBook._id, {
                  duration: parseInt(sessionDuration),
                  pagesRead: pagesRead ? parseInt(pagesRead) : undefined,
                  startPage: startPage ? parseInt(startPage) : undefined,
                  endPage: endPage ? parseInt(endPage) : undefined,
                  notes: sessionNotes.trim() || undefined
                });
                if (success) {
                  setShowSessionModal(false);
                  resetForms();
                }
              }} className="space-y-4">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes) *</label>
                  <input
                    type="number"
                    min="1"
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Page</label>
                    <input
                      type="number"
                      min="0"
                      value={startPage}
                      onChange={(e) => setStartPage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Page</label>
                    <input
                      type="number"
                      min="0"
                      value={endPage}
                      onChange={(e) => setEndPage(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pages Read</label>
                  <input
                    type="number"
                    min="0"
                    value={pagesRead}
                    onChange={(e) => setPagesRead(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Will auto-calculate from start/end pages"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Session Notes</label>
                  <textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Notes about this reading session..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { 
                      setShowSessionModal(false); 
                      resetForms();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Logging...' : 'Log Session'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Summary/Notes Modal */}
      {showSummaryModal && selectedBook && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Reading Notes & Summaries</h3>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-900 mb-2">{selectedBook.title}</h4>
                  <p className="text-purple-700">{selectedBook.author}</p>
                </div>

                {selectedBook.notes && (
                  <div>
                    <h5 className="text-lg font-medium text-gray-900 mb-3">Reading Notes:</h5>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {selectedBook.notes}
                      </p>
                    </div>
                  </div>
                )}

                {selectedBook.sessions && selectedBook.sessions.length > 0 && (
                  <div>
                    <h5 className="text-lg font-medium text-gray-900 mb-3">Session History:</h5>
                    <div className="space-y-3">
                      {selectedBook.sessions.reverse().map((session, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900">
                              {new Date(session.date).toLocaleDateString()}
                            </span>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span>{session.duration} min</span>
                              {session.pagesRead > 0 && (
                                <span>{session.pagesRead} pages</span>
                              )}
                            </div>
                          </div>
                          {session.notes && (
                            <p className="text-gray-700 leading-relaxed">
                              {session.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(!selectedBook.notes && (!selectedBook.sessions || selectedBook.sessions.length === 0)) && (
                  <div className="text-center py-8">
                    <DocumentTextIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No notes yet</h3>
                    <p className="text-gray-600">Start reading and logging sessions to build your reading history</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowSummaryModal(false)}
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

export default SetProgress;