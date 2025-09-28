import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  BookOpenIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  CalendarIcon,
  TagIcon,
  FlagIcon,
  StarIcon,
  DocumentDuplicateIcon,
  ArrowTopRightOnSquareIcon,
  StopIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ChartBarIcon,
  FireIcon
} from '@heroicons/react/24/outline';

const SetBook = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [filters, setFilters] = useState({
    genre: 'all',
    type: 'all',
    status: 'all',
    priority: 'all'
  });
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [viewingBook, setViewingBook] = useState(null);
  const [progressBook, setProgressBook] = useState(null);
  const [sessionBook, setSessionBook] = useState(null);
  const [draggedBook, setDraggedBook] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    title: '',
    author: '',
    description: '',
    type: 'book',
    genre: 'other',
    priority: 'medium',
    status: 'to_read',
    totalPages: '',
    currentPage: '0',
    isbn: '',
    publisher: '',
    publishedDate: '',
    targetDate: '',
    tags: '',
    rating: '',
    review: '',
    notes: '',
    averagePageTime: '3'
  });

  const [editForm, setEditForm] = useState({
    title: '',
    author: '',
    description: '',
    type: 'book',
    genre: 'other',
    priority: 'medium',
    status: 'to_read',
    totalPages: '',
    currentPage: '0',
    isbn: '',
    publisher: '',
    publishedDate: '',
    targetDate: '',
    tags: '',
    rating: '',
    review: '',
    notes: '',
    averagePageTime: '3'
  });

  const [progressForm, setProgressForm] = useState({
    currentPage: '',
    sessionDuration: '',
    sessionNotes: ''
  });

  const [sessionForm, setSessionForm] = useState({
    duration: '',
    pagesRead: '',
    startPage: '',
    endPage: '',
    notes: ''
  });

  // Schema-based options
  const types = ['book', 'article', 'audiobook', 'magazine', 'paper', 'other'];
  const genres = [
    'fiction', 'non-fiction', 'biography', 'business', 'self-help', 'science',
    'history', 'philosophy', 'technology', 'health', 'education', 'thriller',
    'romance', 'fantasy', 'mystery', 'psychology', 'economics', 'politics',
    'religion', 'art', 'other'
  ];
  const priorities = ['low', 'medium', 'high'];
  const statuses = ['to_read', 'reading', 'completed', 'on_hold', 'abandoned'];

  // Status columns configuration
  const statusColumns = {
    to_read: {
      title: 'To Read',
      icon: ClockIcon,
      color: 'gray',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    },
    reading: {
      title: 'Reading',
      icon: PlayIcon,
      color: 'blue',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    on_hold: {
      title: 'On Hold',
      icon: PauseIcon,
      color: 'yellow',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    completed: {
      title: 'Completed',
      icon: CheckCircleIcon,
      color: 'green',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    abandoned: {
      title: 'Abandoned',
      icon: StopIcon,
      color: 'red',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    }
  };

  // Get priority info
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

  // Calculate progress percentage
  const calculateProgress = (book) => {
    if (!book.totalPages || book.totalPages === 0) return 0;
    return Math.round((book.currentPage / book.totalPages) * 100);
  };

  // Reset forms
  const resetForms = () => {
    setCreateForm({
      title: '',
      author: '',
      description: '',
      type: 'book',
      genre: 'other',
      priority: 'medium',
      status: 'to_read',
      totalPages: '',
      currentPage: '0',
      isbn: '',
      publisher: '',
      publishedDate: '',
      targetDate: '',
      tags: '',
      rating: '',
      review: '',
      notes: '',
      averagePageTime: '3'
    });
    setEditForm({
      title: '',
      author: '',
      description: '',
      type: 'book',
      genre: 'other',
      priority: 'medium',
      status: 'to_read',
      totalPages: '',
      currentPage: '0',
      isbn: '',
      publisher: '',
      publishedDate: '',
      targetDate: '',
      tags: '',
      rating: '',
      review: '',
      notes: '',
      averagePageTime: '3'
    });
    setProgressForm({
      currentPage: '',
      sessionDuration: '',
      sessionNotes: ''
    });
    setSessionForm({
      duration: '',
      pagesRead: '',
      startPage: '',
      endPage: '',
      notes: ''
    });
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
        limit: '100'
      });

      if (filters.genre !== 'all') {
        params.append('genre', filters.genre);
      }
      if (filters.type !== 'all') {
        params.append('type', filters.type);
      }
      if (filters.status !== 'all') {
        params.append('status', filters.status);
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

      if (response.ok) {
        const data = await response.json();
        setBooks(data.readings || []);
      } else if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
      } else {
        console.error('Failed to load books');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading books:', error);
      setLoading(false);
    }
  };

  // Create book
  const handleCreateBook = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const bookData = {
        title: createForm.title,
        author: createForm.author,
        description: createForm.description,
        type: createForm.type,
        genre: createForm.genre,
        priority: createForm.priority,
        status: createForm.status,
        totalPages: createForm.totalPages ? Number(createForm.totalPages) : undefined,
        currentPage: createForm.currentPage ? Number(createForm.currentPage) : 0,
        isbn: createForm.isbn || undefined,
        publisher: createForm.publisher || undefined,
        publishedDate: createForm.publishedDate ? new Date(createForm.publishedDate) : undefined,
        targetDate: createForm.targetDate ? new Date(createForm.targetDate) : undefined,
        tags: createForm.tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag),
        rating: createForm.rating ? Number(createForm.rating) : undefined,
        review: createForm.review || undefined,
        notes: createForm.notes || undefined,
        averagePageTime: createForm.averagePageTime ? Number(createForm.averagePageTime) : 3
      };

      const response = await fetch('http://localhost:5001/api/reading', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookData)
      });

      if (response.ok) {
        setShowCreateModal(false);
        resetForms();
        loadBooksData();
        console.log('✅ Book created successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create book');
      }
    } catch (error) {
      console.error('Error creating book:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update book status (for drag and drop)
  const updateBookStatus = async (bookId, newStatus) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`http://localhost:5001/api/reading/${bookId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        loadBooksData();
        console.log(`✅ Book status updated to ${newStatus}`);
      } else {
        console.error('Failed to update book status');
        loadBooksData(); // Reload to reset UI
      }
    } catch (error) {
      console.error('Error updating book status:', error);
      loadBooksData(); // Reload to reset UI
    }
  };

  // Edit book
  const handleEditBook = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const bookData = {
        title: editForm.title,
        author: editForm.author,
        description: editForm.description,
        type: editForm.type,
        genre: editForm.genre,
        priority: editForm.priority,
        status: editForm.status,
        totalPages: editForm.totalPages ? Number(editForm.totalPages) : undefined,
        currentPage: editForm.currentPage ? Number(editForm.currentPage) : 0,
        isbn: editForm.isbn || undefined,
        publisher: editForm.publisher || undefined,
        publishedDate: editForm.publishedDate ? new Date(editForm.publishedDate) : undefined,
        targetDate: editForm.targetDate ? new Date(editForm.targetDate) : undefined,
        tags: editForm.tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag),
        rating: editForm.rating ? Number(editForm.rating) : undefined,
        review: editForm.review || undefined,
        notes: editForm.notes || undefined,
        averagePageTime: editForm.averagePageTime ? Number(editForm.averagePageTime) : 3
      };

      const response = await fetch(`http://localhost:5001/api/reading/${editingBook._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookData)
      });

      if (response.ok) {
        setShowEditModal(false);
        setEditingBook(null);
        resetForms();
        loadBooksData();
        console.log('✅ Book updated successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update book');
      }
    } catch (error) {
      console.error('Error updating book:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update progress
  const handleUpdateProgress = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const progressData = {
        currentPage: Number(progressForm.currentPage),
        sessionDuration: progressForm.sessionDuration ? Number(progressForm.sessionDuration) : undefined,
        notes: progressForm.sessionNotes || undefined
      };

      const response = await fetch(`http://localhost:5001/api/reading/${progressBook._id}/progress`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(progressData)
      });

      if (response.ok) {
        setShowProgressModal(false);
        setProgressBook(null);
        resetForms();
        loadBooksData();
        console.log('✅ Progress updated successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update progress');
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Log reading session
  const handleLogSession = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const sessionData = {
        duration: sessionForm.duration ? Number(sessionForm.duration) : undefined,
        pagesRead: sessionForm.pagesRead ? Number(sessionForm.pagesRead) : undefined,
        startPage: sessionForm.startPage ? Number(sessionForm.startPage) : undefined,
        endPage: sessionForm.endPage ? Number(sessionForm.endPage) : undefined,
        notes: sessionForm.notes || undefined
      };

      const response = await fetch(`http://localhost:5001/api/reading/${sessionBook._id}/session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sessionData)
      });

      if (response.ok) {
        setShowSessionModal(false);
        setSessionBook(null);
        resetForms();
        loadBooksData();
        console.log('✅ Session logged successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to log session');
      }
    } catch (error) {
      console.error('Error logging session:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete book
  const handleDeleteBook = async (bookId) => {
    if (!window.confirm('Are you sure you want to delete this book? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5001/api/reading/${bookId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        loadBooksData();
        console.log('✅ Book deleted successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete book');
      }
    } catch (error) {
      console.error('Error deleting book:', error);
      alert('Network error. Please try again.');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, book) => {
    setDraggedBook(book);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    if (draggedBook && draggedBook.status !== newStatus) {
      updateBookStatus(draggedBook._id, newStatus);
    }
    setDraggedBook(null);
  };

  // Open modals
  const openEditModal = (book) => {
    setEditingBook(book);
    setEditForm({
      title: book.title,
      author: book.author || '',
      description: book.description || '',
      type: book.type || 'book',
      genre: book.genre || 'other',
      priority: book.priority || 'medium',
      status: book.status,
      totalPages: book.totalPages || '',
      currentPage: book.currentPage || '0',
      isbn: book.isbn || '',
      publisher: book.publisher || '',
      publishedDate: book.publishedDate ? new Date(book.publishedDate).toISOString().split('T')[0] : '',
      targetDate: book.targetDate ? new Date(book.targetDate).toISOString().split('T')[0] : '',
      tags: book.tags ? book.tags.join(', ') : '',
      rating: book.rating || '',
      review: book.review || '',
      notes: book.notes || '',
      averagePageTime: book.averagePageTime || '3'
    });
    setShowEditModal(true);
  };

  const openViewModal = async (book) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5001/api/reading/${book._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const detailedBook = await response.json();
        setViewingBook(detailedBook);
        setShowViewModal(true);
      } else {
        console.error('Failed to load book details');
      }
    } catch (error) {
      console.error('Error loading book details:', error);
    }
  };

  const openProgressModal = (book) => {
    setProgressBook(book);
    setProgressForm({
      currentPage: book.currentPage?.toString() || '0',
      sessionDuration: '',
      sessionNotes: ''
    });
    setShowProgressModal(true);
  };

  const openSessionModal = (book) => {
    setSessionBook(book);
    setSessionForm({
      duration: '',
      pagesRead: '',
      startPage: book.currentPage?.toString() || '0',
      endPage: '',
      notes: ''
    });
    setShowSessionModal(true);
  };

  // Group books by status
  const booksByStatus = books.reduce((acc, book) => {
    const status = book.status || 'to_read';
    if (!acc[status]) acc[status] = [];
    acc[status].push(book);
    return acc;
  }, {});

  // Calculate totals
  const calculateTotals = () => {
    const total = books.length;
    const toRead = books.filter(book => book.status === 'to_read').length;
    const reading = books.filter(book => book.status === 'reading').length;
    const onHold = books.filter(book => book.status === 'on_hold').length;
    const completed = books.filter(book => book.status === 'completed').length;
    const abandoned = books.filter(book => book.status === 'abandoned').length;

    return { total, toRead, reading, onHold, completed, abandoned };
  };

  useEffect(() => {
    loadBooksData();
  }, [filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <BookOpenIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Books</h3>
            <p className="text-3xl font-bold text-blue-600">{totals.total}</p>
            <div className="mt-3 text-sm text-gray-600">All books</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-gray-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">To Read</h3>
            <p className="text-3xl font-bold text-gray-600">{totals.toRead}</p>
            <div className="mt-3 text-sm text-gray-600">In queue</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <PlayIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Reading</h3>
            <p className="text-3xl font-bold text-blue-600">{totals.reading}</p>
            <div className="mt-3 text-sm text-gray-600">Currently active</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center">
                <PauseIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">On Hold</h3>
            <p className="text-3xl font-bold text-yellow-600">{totals.onHold}</p>
            <div className="mt-3 text-sm text-gray-600">Paused</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Completed</h3>
            <p className="text-3xl font-bold text-green-600">{totals.completed}</p>
            <div className="mt-3 text-sm text-gray-600">Finished</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4">
              <select
                value={filters.genre}
                onChange={(e) => setFilters(prev => ({ ...prev, genre: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Genres</option>
                {genres.map(genre => (
                  <option key={genre} value={genre}>{genre.charAt(0).toUpperCase() + genre.slice(1).replace('-', ' ')}</option>
                ))}
              </select>
              
              <select
                value={filters.type}
                onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                {types.map(type => (
                  <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</option>
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
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center space-x-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Book</span>
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {statuses.map(status => {
            const column = statusColumns[status];
            const Icon = column.icon;
            const statusBooks = booksByStatus[status] || [];

            return (
              <div
                key={status}
                className={`${column.bgColor} rounded-xl shadow-sm min-h-96`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className={`p-4 border-b ${column.borderColor} bg-white rounded-t-xl`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className={`w-5 h-5 text-${column.color}-600`} />
                      <h3 className="text-lg font-semibold text-gray-900">{column.title}</h3>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-sm font-medium bg-${column.color}-100 text-${column.color}-600`}>
                      {statusBooks.length}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {statusBooks.map(book => {
                    const progress = calculateProgress(book);
                    
                    return (
                      <div
                        key={book._id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, book)}
                        className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing min-h-[200px]"
                      >
                        {/* Title and Author */}
                        <div className="mb-3">
                          <h4 className="font-medium text-gray-900 mb-1">{book.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{book.author}</p>
                          
                          {/* Action Buttons */}
                          <div className="flex items-center space-x-1 mb-3">
                            <button 
                              onClick={() => openViewModal(book)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="View book details"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => openEditModal(book)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="Edit book"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            {(book.status === 'reading' || book.status === 'to_read') && (
                              <button 
                                onClick={() => openProgressModal(book)}
                                className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                title="Update progress"
                              >
                                <ChartBarIcon className="w-4 h-4" />
                              </button>
                            )}
                            {book.status === 'reading' && (
                              <button 
                                onClick={() => openSessionModal(book)}
                                className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                title="Log reading session"
                              >
                                <FireIcon className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteBook(book._id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete book"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Description */}
                          {book.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed mb-3">{book.description}</p>
                          )}
                        </div>

                        {/* Priority, Genre, and Type badges */}
                        <div className="flex flex-col space-y-2 mb-3">
                          <div className="flex flex-wrap gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityInfo(book.priority)}`}>
                              {book.priority}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                              {book.genre}
                            </span>
                            {book.type !== 'book' && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs rounded-full">
                                {book.type}
                              </span>
                            )}
                          </div>
                          
                          {book.targetDate && (
                            <div className="flex items-center text-gray-500">
                              <CalendarIcon className="w-3 h-3 mr-1" />
                              <span className="text-xs">
                                Due: {new Date(book.targetDate).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: '2-digit'
                                })}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Reading Progress */}
                        {book.totalPages && book.totalPages > 0 && (
                          <div className="mb-4">
                            <div className="text-xs text-gray-500 mb-2">Reading Progress</div>
                            <div className="flex items-center space-x-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-gray-500 font-medium min-w-[3rem]">
                                {book.currentPage}/{book.totalPages}
                              </span>
                            </div>
                            <div className="text-xs text-blue-600 font-medium mt-1">
                              {progress}% Complete
                            </div>
                          </div>
                        )}

                        {/* Footer with Rating and Tags */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          {book.rating && (
                            <div className="flex items-center">
                              {getRatingStars(book.rating)}
                              <span className="text-xs text-gray-500 ml-1">({book.rating})</span>
                            </div>
                          )}
                          
                          {book.tags && book.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {book.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded font-medium">
                                  #{tag}
                                </span>
                              ))}
                              {book.tags.length > 2 && (
                                <span className="text-xs text-gray-500 font-medium">+{book.tags.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {statusBooks.length === 0 && (
                    <div className="text-center py-8">
                      <Icon className={`w-12 h-12 text-${column.color}-300 mx-auto mb-2`} />
                      <p className="text-sm text-gray-500">No books in this status</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Add New Book</h3>
                <button
                  onClick={() => { setShowCreateModal(false); resetForms(); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateBook} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                    <input
                      type="text"
                      value={createForm.title}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="The Great Gatsby"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Author</label>
                    <input
                      type="text"
                      value={createForm.author}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, author: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="F. Scott Fitzgerald"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Brief description of the book..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                    <select
                      value={createForm.type}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {types.map(type => (
                        <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Genre</label>
                    <select
                      value={createForm.genre}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, genre: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {genres.map(genre => (
                        <option key={genre} value={genre}>{genre.charAt(0).toUpperCase() + genre.slice(1).replace('-', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select
                      value={createForm.priority}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {priorities.map(priority => (
                        <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Total Pages</label>
                    <input
                      type="number"
                      min="1"
                      value={createForm.totalPages}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, totalPages: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Page</label>
                    <input
                      type="number"
                      min="0"
                      value={createForm.currentPage}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, currentPage: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Avg Page Time (min)</label>
                    <input
                      type="number"
                      min="0.5"
                      max="30"
                      step="0.5"
                      value={createForm.averagePageTime}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, averagePageTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">ISBN (Optional)</label>
                    <input
                      type="text"
                      value={createForm.isbn}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, isbn: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="978-3-16-148410-0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Publisher (Optional)</label>
                    <input
                      type="text"
                      value={createForm.publisher}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, publisher: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Penguin Books"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Published Date (Optional)</label>
                    <input
                      type="date"
                      value={createForm.publishedDate}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, publishedDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Date (Optional)</label>
                    <input
                      type="date"
                      value={createForm.targetDate}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, targetDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags (Optional)</label>
                  <input
                    type="text"
                    value={createForm.tags}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="classic, american-literature, drama (comma separated)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rating (1-5) (Optional)</label>
                    <select
                      value={createForm.rating}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, rating: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">No rating</option>
                      <option value="1">1 Star</option>
                      <option value="2">2 Stars</option>
                      <option value="3">3 Stars</option>
                      <option value="4">4 Stars</option>
                      <option value="5">5 Stars</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Review (Optional)</label>
                  <textarea
                    value={createForm.review}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, review: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Your thoughts on this book..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                  <textarea
                    value={createForm.notes}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Reading notes, quotes, thoughts..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); resetForms(); }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Book'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Additional modals would go here - Edit Modal, View Modal, Progress Modal, Session Modal */}
      {/* For brevity, I'm showing the structure but you'd implement similar modals to the create modal */}

    </main>
  );
};

export default SetBook;