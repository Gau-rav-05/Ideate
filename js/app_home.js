/**
 * Ideate - Platform Home, Feed Controller & Saved Collections Engine
 */

document.addEventListener('DOMContentLoaded', () => {
	// 1. Page Transition Curtain Fade-in
	const curtain = document.getElementById('pageTransitionCurtain');
	if (curtain) {
		requestAnimationFrame(() => {
			setTimeout(() => {
				curtain.classList.add('loaded');
			}, 50);
		});
	}

	// 2. DOM Elements
	const feedContainer = document.getElementById('ideaFeedContainer');
	const themeLinks = document.querySelectorAll('#themeNavList .sidebar-nav-link');
	const ideaCards = document.querySelectorAll('.idea-card');
	const searchInput = document.querySelector('.app-search-input');
	const collectionNavList = document.getElementById('collectionNavList');
	const btnOpenAddCollectionModal = document.getElementById('btnOpenAddCollectionModal');
	const collectionModal = document.getElementById('collectionModal');
	const collectionModalCloseBtn = document.getElementById('collectionModalCloseBtn');
	const collectionModalCancelBtn = document.getElementById('collectionModalCancelBtn');
	const createCollectionForm = document.getElementById('createCollectionForm');
	const collectionNameInput = document.getElementById('collectionNameInput');
	const collectionIconPicker = document.getElementById('collectionIconPicker');

	// Project Modal Elements
	const projectModal = document.getElementById('projectModal');
	const modalCloseBtn = document.getElementById('modalCloseBtn');
	const modalSaveBtn = document.getElementById('modalSaveBtn');
	const modalSaveBtnText = document.getElementById('modalSaveBtnText');
	const modalJoinBtn = document.getElementById('modalJoinBtn');
	const modalJoinBtnText = document.getElementById('modalJoinBtnText');
	const modalStarBtn = document.getElementById('modalStarBtn');
	const modalAvatar = document.getElementById('modalAvatar');
	const modalAuthor = document.getElementById('modalAuthor');
	const modalTime = document.getElementById('modalTime');
	const modalTitle = document.getElementById('modalTitle');
	const modalDesc = document.getElementById('modalDesc');
	const modalTags = document.getElementById('modalTags');
	const modalSeeking = document.getElementById('modalSeeking');

	let currentOpenCard = null;

	// 3. Saved Collections State Management & LocalStorage Persistence
	const DEFAULT_USER_COLLECTIONS = [
		{ id: 'quantum-rnd', name: 'Quantum & Hardware R&D', icon: 'fa-bolt' }
	];

	let userCollections = [];
	try {
		const stored = localStorage.getItem('ideate_user_collections');
		userCollections = stored ? JSON.parse(stored) : DEFAULT_USER_COLLECTIONS;
	} catch (e) {
		userCollections = DEFAULT_USER_COLLECTIONS;
	}

	// Saved Ideas Map: { [ideaId]: [collectionIds...] }
	let savedMap = {};
	try {
		const stored = localStorage.getItem('ideate_saved_ideas');
		savedMap = stored ? JSON.parse(stored) : { 'idea-solar-mesh': ['saved'] };
	} catch (e) {
		savedMap = { 'idea-solar-mesh': ['saved'] };
	}

	// Joined Ideas Set: array of ideaIds
	let joinedList = [];
	try {
		const stored = localStorage.getItem('ideate_joined_ideas');
		joinedList = stored ? JSON.parse(stored) : ['idea-solar-mesh'];
	} catch (e) {
		joinedList = ['idea-solar-mesh'];
	}

	let activeTheme = 'all';
	let activeCollection = null; // null | 'joined' | 'saved' | custom collection id
	let activeSearchQuery = '';
	let filterTransitionTimeout = null;

	function persistState() {
		try {
			localStorage.setItem('ideate_user_collections', JSON.stringify(userCollections));
			localStorage.setItem('ideate_saved_ideas', JSON.stringify(savedMap));
			localStorage.setItem('ideate_joined_ideas', JSON.stringify(joinedList));
		} catch (e) {
			console.error('LocalStorage persist error:', e);
		}
	}

	// Calculate counts
	function getJoinedCount() {
		return joinedList.length;
	}

	function getSavedCount(collectionId = 'saved') {
		let count = 0;
		Object.values(savedMap).forEach(cols => {
			if (cols && cols.includes(collectionId)) count++;
		});
		return count;
	}

	// 4. Render & Update Collections Sidebar
	function renderCollectionsSidebar() {
		if (!collectionNavList) return;

		// 1. Joined Projects Link (Primary/Pinned #1)
		const joinedCount = getJoinedCount();
		const savedCount = getSavedCount('saved');

		let html = `
			<li>
				<a href="#" class="sidebar-nav-link collection-link ${activeCollection === 'joined' ? 'active' : ''}" data-collection="joined" id="collectionJoinedLink">
					<i class="fas fa-rocket"></i>
					<span>Joined Projects</span>
					<span class="nav-count-badge" id="badgeJoinedCount">${joinedCount}</span>
				</a>
			</li>
			<li>
				<a href="#" class="sidebar-nav-link collection-link ${activeCollection === 'saved' ? 'active' : ''}" data-collection="saved" id="collectionSavedLink">
					<i class="fas fa-bookmark"></i>
					<span>Saved Thoughts</span>
					<span class="nav-count-badge" id="badgeSavedCount">${savedCount}</span>
				</a>
			</li>
		`;

		// 2. Custom User Collections
		userCollections.forEach(col => {
			const count = getSavedCount(col.id);
			const isColActive = activeCollection === col.id ? 'active' : '';
			html += `
				<li>
					<a href="#" class="sidebar-nav-link collection-link ${isColActive}" data-collection="${col.id}">
						<i class="fas ${col.icon || 'fa-folder'}"></i>
						<span>${col.name}</span>
						<span class="nav-count-badge">${count}</span>
					</a>
				</li>
			`;
		});

		collectionNavList.innerHTML = html;
		bindCollectionLinkEvents();
	}

	function bindCollectionLinkEvents() {
		const colLinks = document.querySelectorAll('.collection-link');
		colLinks.forEach(link => {
			link.addEventListener('click', (e) => {
				e.preventDefault();
				const targetCollection = link.getAttribute('data-collection');

				// Deselect theme links if clicking collection
				themeLinks.forEach(l => l.classList.remove('active'));
				colLinks.forEach(l => l.classList.remove('active'));

				link.classList.add('active');
				activeCollection = targetCollection;
				activeTheme = 'all';

				runAnimatedFilter();
			});
		});
	}

	// 4.5 Utility Helpers & Dynamic Card Generator
	function escapeHtml(str) {
		if (!str) return '';
		return String(str).replace(/[&<>"']/g, (m) => {
			return {
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#039;'
			}[m];
		});
	}

	function createIdeaCardElement(data) {
		const article = document.createElement('article');
		article.className = 'idea-card card-enter-anim';
		article.id = data.id;
		article.setAttribute('data-id', data.id);
		article.setAttribute('data-theme', data.theme);
		article.setAttribute('data-title', data.title);
		article.setAttribute('data-author', data.author || '@creator_01');
		article.setAttribute('data-avatar', data.avatar || 'M');
		article.setAttribute('data-time', data.time || 'Just now');
		article.setAttribute('data-desc', data.desc);
		article.setAttribute('data-seeking', data.seeking || '');
		article.setAttribute('data-tags', data.tags || '');

		let rolesHtml = '';
		if (data.seeking) {
			const rolesArr = data.seeking.split(',').map(r => r.trim()).filter(Boolean);
			if (rolesArr.length > 0) {
				rolesHtml = `<div class="seeking-roles"><span class="seeking-label">Seeking:</span>` +
					rolesArr.map(r => `<span class="role-pill">${escapeHtml(r)}</span>`).join('') +
					`</div>`;
			}
		}

		const isSaved = savedMap[data.id] && savedMap[data.id].length > 0;
		const isJoined = joinedList.includes(data.id);

		article.innerHTML = `
			<div class="idea-card-header">
				<div class="creator-meta">
					<div class="creator-avatar">${escapeHtml(data.avatar || 'M')}</div>
					<div class="creator-info">
						<span class="creator-name">${escapeHtml(data.author || '@creator_01')}</span>
						<span class="idea-timestamp">${escapeHtml(data.time || 'Just now')}</span>
					</div>
				</div>
			</div>

			<h2 class="idea-title">${escapeHtml(data.title)}</h2>
			<p class="idea-description">${escapeHtml(data.desc)}</p>

			${rolesHtml}

			<div class="idea-card-footer">
				<div class="card-footer-left">
					<button class="save-action-btn ${isSaved ? 'active' : ''}" title="Save to Collections" type="button" data-id="${data.id}">
						<i class="${isSaved ? 'fas' : 'far'} fa-bookmark"></i>
						<span class="save-btn-label">${isSaved ? 'Saved' : 'Save'}</span>
					</button>
					<button class="join-action-btn ${isJoined ? 'active' : ''}" title="Join this project" type="button" data-id="${data.id}">
						<i class="fas ${isJoined ? 'fa-check' : 'fa-plus'}"></i>
						<span class="join-btn-label">${isJoined ? 'Joined' : 'Join'}</span>
					</button>
				</div>
				<div class="card-footer-right">
					<button class="star-action-btn" title="Star this project" type="button">
						<i class="far fa-star"></i>
						<span class="star-count">${data.stars || 0}</span>
					</button>
				</div>
			</div>
		`;

		bindCardEvents(article);
		return article;
	}

	function bindCardEvents(card) {
		if (!card) return;
		card.addEventListener('click', (e) => {
			if (e.target.closest('button')) return;
			openProjectModal(card);
		});

		const saveBtn = card.querySelector('.save-action-btn');
		if (saveBtn) {
			saveBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				const cardId = saveBtn.getAttribute('data-id') || card.getAttribute('data-id') || card.id;
				if (cardId) toggleIdeaSave(cardId);
			});
		}

		const joinBtn = card.querySelector('.join-action-btn');
		if (joinBtn) {
			joinBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				const cardId = joinBtn.getAttribute('data-id') || card.getAttribute('data-id') || card.id;
				if (cardId) toggleIdeaJoin(cardId);
			});
		}

		const starBtn = card.querySelector('.star-action-btn:not(#modalStarBtn)');
		if (starBtn) {
			bindStarButton(starBtn);
		}
	}

	// 5. Initial Entrance Animation & Custom Ideas Restore
	let customIdeas = [];
	try {
		const storedCustom = localStorage.getItem('ideate_custom_ideas');
		customIdeas = storedCustom ? JSON.parse(storedCustom) : [];
	} catch (e) {
		customIdeas = [];
	}

	if (feedContainer && customIdeas.length > 0) {
		customIdeas.slice().reverse().forEach(data => {
			const cardElem = createIdeaCardElement(data);
			feedContainer.prepend(cardElem);
		});
	}

	document.querySelectorAll('.idea-card').forEach((card, index) => {
		card.style.setProperty('--stagger-index', index);
		card.classList.add('card-enter-anim');

		const cardId = card.getAttribute('data-id') || card.id;
		updateCardVisualState(card, cardId);
	});

	function updateCardVisualState(card, cardId) {
		if (!card || !cardId) return;

		const saveBtn = card.querySelector('.save-action-btn');
		const joinBtn = card.querySelector('.join-action-btn');

		const isSaved = savedMap[cardId] && savedMap[cardId].length > 0;
		const isJoined = joinedList.includes(cardId);

		if (saveBtn) {
			const saveIcon = saveBtn.querySelector('i');
			const saveLabel = saveBtn.querySelector('.save-btn-label');
			if (isSaved) {
				saveBtn.classList.add('active');
				if (saveIcon) saveIcon.className = 'fas fa-bookmark';
				if (saveLabel) saveLabel.textContent = 'Saved';
			} else {
				saveBtn.classList.remove('active');
				if (saveIcon) saveIcon.className = 'far fa-bookmark';
				if (saveLabel) saveLabel.textContent = 'Save';
			}
		}

		if (joinBtn) {
			const joinIcon = joinBtn.querySelector('i');
			const joinLabel = joinBtn.querySelector('.join-btn-label');
			if (isJoined) {
				joinBtn.classList.add('active');
				if (joinIcon) joinIcon.className = 'fas fa-check';
				if (joinLabel) joinLabel.textContent = 'Joined';
			} else {
				joinBtn.classList.remove('active');
				if (joinIcon) joinIcon.className = 'fas fa-plus';
				if (joinLabel) joinLabel.textContent = 'Join';
			}
		}
	}

	// 6. Feed Empty State Generator
	function updateFeedEmptyState(matchingCount) {
		if (!feedContainer) return;
		let emptyState = feedContainer.querySelector('.feed-empty-state');

		if (matchingCount === 0) {
			if (!emptyState) {
				emptyState = document.createElement('div');
				emptyState.className = 'feed-empty-state card-enter-anim';
				feedContainer.appendChild(emptyState);
			}

			let title = 'No Thoughts Found';
			let desc = 'No blueprints match your active criteria. Be the pioneer to spawn the first node.';
			let iconClass = 'fa-layer-group';

			if (activeCollection === 'joined') {
				title = 'No Joined Projects Yet';
				desc = 'You haven\'t joined any project crews yet. Click "Join" on any idea card or modal to collaborate.';
				iconClass = 'fa-rocket';
			} else if (activeCollection) {
				const colObj = userCollections.find(c => c.id === activeCollection);
				const colName = colObj ? colObj.name : 'Saved Thoughts';
				title = `No Ideas in "${colName}"`;
				desc = 'Bookmark interesting thoughts using the Save button at the bottom-left of cards or inside project details.';
				iconClass = 'fa-bookmark';
			} else if (activeTheme !== 'all') {
				const themeNames = {
					'system-design': 'System Design',
					'web-cloud': 'Web & Cloud',
					'mobile-apps': 'App Development',
					'cybersecurity': 'Cybersecurity',
					'ai-ml': 'AI & Machine Learning',
					'hardware-robotics': 'Hardware & Robotics',
					'quantum-bio': 'Quantum & Bio-Tech'
				};
				title = `No Thoughts in ${themeNames[activeTheme] || 'This Category'} Yet`;
				desc = 'Be the first innovator to spawn a thought node in this category and mobilize a crew.';
			}

			emptyState.innerHTML = `
				<div class="empty-state-glow"></div>
				<div class="empty-state-icon">
					<i class="fas ${iconClass}"></i>
				</div>
				<h3 class="empty-state-title">${title}</h3>
				<p class="empty-state-desc">${desc}</p>
				<a href="#spawn" class="btn-spawn-idea empty-state-btn">
					<i class="fas fa-plus"></i>
					<span>SPAWN FIRST NODE</span>
				</a>
			`;
		} else if (emptyState) {
			emptyState.remove();
		}
	}

	// 7. Core Animated Filter Pipeline
	function runAnimatedFilter() {
		if (filterTransitionTimeout) {
			clearTimeout(filterTransitionTimeout);
		}

		const currentCards = Array.from(document.querySelectorAll('.idea-card'));
		const visibleCards = currentCards.filter(card => card.style.display !== 'none');

		// Phase 1: Trigger exit animation on currently visible cards
		visibleCards.forEach(card => {
			card.classList.remove('card-enter-anim');
			card.classList.add('card-exit-anim');
		});

		const exitDuration = visibleCards.length > 0 ? 120 : 0;

		// Phase 2: Switch display state and stagger entrance animation
		filterTransitionTimeout = setTimeout(() => {
			let matchingIndex = 0;
			const cleanQuery = activeSearchQuery.toLowerCase().trim();

			currentCards.forEach(card => {
				card.classList.remove('card-exit-anim');

				const cardId = card.getAttribute('data-id') || card.id;
				const cardTheme = card.getAttribute('data-theme') || '';
				const title = card.querySelector('.idea-title')?.textContent.toLowerCase() || '';
				const desc = card.querySelector('.idea-description')?.textContent.toLowerCase() || '';
				const creator = card.querySelector('.creator-name')?.textContent.toLowerCase() || '';
				const tags = card.getAttribute('data-tags')?.toLowerCase() || '';

				// Theme match
				const matchesTheme = (activeTheme === 'all' || cardTheme === activeTheme);

				// Collection match
				let matchesCollection = true;
				if (activeCollection === 'joined') {
					matchesCollection = joinedList.includes(cardId);
				} else if (activeCollection) {
					matchesCollection = savedMap[cardId] && savedMap[cardId].includes(activeCollection);
				}

				// Query match
				const matchesQuery = (!cleanQuery || title.includes(cleanQuery) || desc.includes(cleanQuery) || creator.includes(cleanQuery) || tags.includes(cleanQuery));

				if (matchesTheme && matchesCollection && matchesQuery) {
					card.style.display = 'block';
					card.style.setProperty('--stagger-index', matchingIndex);
					card.classList.add('card-enter-anim');
					matchingIndex++;
				} else {
					card.style.display = 'none';
					card.classList.remove('card-enter-anim');
				}
			});

			updateFeedEmptyState(matchingIndex);

			if (feedContainer) {
				feedContainer.scrollTo({ top: 0, behavior: 'smooth' });
			}
		}, exitDuration);
	}

	// 8. Sidebar Theme Link Events
	themeLinks.forEach(link => {
		link.addEventListener('click', (e) => {
			e.preventDefault();
			themeLinks.forEach(l => l.classList.remove('active'));
			link.classList.add('active');

			// Deselect collection link when selecting a theme
			document.querySelectorAll('.collection-link').forEach(l => l.classList.remove('active'));
			activeCollection = null;

			activeTheme = link.getAttribute('data-theme') || 'all';
			runAnimatedFilter();
		});
	});

	// 9. Search Input Filter Event
	if (searchInput) {
		searchInput.addEventListener('input', () => {
			activeSearchQuery = searchInput.value;
			runAnimatedFilter();
		});
	}

	// 10. Card Save Button Handler (Bottom-Left)
	function toggleIdeaSave(cardId) {
		const targetCollection = (activeCollection && activeCollection !== 'joined') ? activeCollection : 'saved';
		const wasSaved = savedMap[cardId] && savedMap[cardId].length > 0;
		
		if (!savedMap[cardId]) {
			savedMap[cardId] = [];
		}

		const index = savedMap[cardId].indexOf(targetCollection);
		if (index > -1) {
			savedMap[cardId].splice(index, 1);
			if (savedMap[cardId].length === 0) delete savedMap[cardId];
		} else {
			savedMap[cardId].push(targetCollection);
		}

		persistState();
		renderCollectionsSidebar();

		// Update card in feed
		const card = document.querySelector(`.idea-card[data-id="${cardId}"], #${cardId}`);
		if (card) {
			updateCardVisualState(card, cardId);
		}

		// Update modal if open
		if (currentOpenCard && (currentOpenCard.getAttribute('data-id') === cardId || currentOpenCard.id === cardId)) {
			syncModalSaveBtn(cardId);
		}

		// If current view is collection, re-filter smoothly
		if (activeCollection && activeCollection !== 'joined') {
			runAnimatedFilter();
		}

		// Live notification on saving
		const isNowSaved = savedMap[cardId] && savedMap[cardId].length > 0;
		if (!wasSaved && isNowSaved) {
			const title = card?.getAttribute('data-title') || card?.querySelector('.idea-title')?.textContent?.trim() || 'Blueprint Node';
			addNotification({
				type: 'bookmark',
				actor: 'YOU',
				avatar: 'M',
				avatarBg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(147, 51, 234, 0.2))',
				icon: 'fa-bookmark',
				iconColor: '#a855f7',
				text: 'saved blueprint to collections:',
				targetTitle: title,
				ideaId: cardId,
				playChirp: false
			});
		}
	}

	// Card Join Button Handler (Bottom-Left)
	function toggleIdeaJoin(cardId) {
		const idx = joinedList.indexOf(cardId);
		let newlyJoined = false;
		if (idx > -1) {
			joinedList.splice(idx, 1);
		} else {
			joinedList.push(cardId);
			newlyJoined = true;
		}

		persistState();
		renderCollectionsSidebar();

		// Update card in feed
		const card = document.querySelector(`.idea-card[data-id="${cardId}"], #${cardId}`);
		if (card) {
			updateCardVisualState(card, cardId);
		}

		// Update modal if open
		if (currentOpenCard && (currentOpenCard.getAttribute('data-id') === cardId || currentOpenCard.id === cardId)) {
			syncModalJoinBtn(cardId);
		}

		// If current view is joined collection, re-filter smoothly
		if (activeCollection === 'joined') {
			runAnimatedFilter();
		}

		// Live notification on joining a crew
		if (newlyJoined) {
			const title = card?.getAttribute('data-title') || card?.querySelector('.idea-title')?.textContent?.trim() || 'Blueprint Node';
			addNotification({
				type: 'joined',
				actor: 'YOU',
				avatar: 'M',
				avatarBg: 'linear-gradient(135deg, rgba(56, 189, 248, 0.4), rgba(14, 165, 233, 0.2))',
				icon: 'fa-rocket',
				iconColor: '#38bdf8',
				text: 'joined the crew for',
				targetTitle: title,
				ideaId: cardId,
				playChirp: true
			});
		}
	}

	// Delegate card click events for Save and Join
	document.querySelectorAll('.save-action-btn').forEach(btn => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			const cardId = btn.getAttribute('data-id') || btn.closest('.idea-card')?.id;
			if (cardId) toggleIdeaSave(cardId);
		});
	});

	document.querySelectorAll('.join-action-btn').forEach(btn => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			const cardId = btn.getAttribute('data-id') || btn.closest('.idea-card')?.id;
			if (cardId) toggleIdeaJoin(cardId);
		});
	});

	// 11. Star Rating System
	function bindStarButton(btn) {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			const countSpan = btn.querySelector('.star-count');
			const starIcon = btn.querySelector('i');
			let count = parseInt(countSpan.textContent, 10) || 0;
			const isCurrentlyActive = btn.classList.contains('active');
			
			if (isCurrentlyActive) {
				btn.classList.remove('active');
				if (starIcon) starIcon.className = 'far fa-star';
				countSpan.textContent = Math.max(0, count - 1);
			} else {
				btn.classList.add('active');
				if (starIcon) starIcon.className = 'fas fa-star';
				countSpan.textContent = count + 1;

				// Instant auditory feedback + creator echo after 2.2s
				playChirpSound();
				const card = btn.closest('.idea-card') || currentOpenCard;
				const cardId = card?.getAttribute('data-id') || card?.id;
				const author = card?.dataset?.author || card?.querySelector('.creator-name')?.textContent?.trim() || '@creator';
				const title = card?.dataset?.title || card?.querySelector('.idea-title')?.textContent?.trim() || 'Blueprint';
				const authorAvatar = card?.dataset?.avatar || card?.querySelector('.creator-avatar')?.textContent?.trim() || author.charAt(1).toUpperCase();

				setTimeout(() => {
					addNotification({
						type: 'spark',
						actor: author,
						avatar: authorAvatar,
						avatarBg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.4), rgba(245, 158, 11, 0.2))',
						icon: 'fa-bolt',
						iconColor: '#fbbf24',
						text: 'appreciated your spark on',
						targetTitle: title,
						ideaId: cardId,
						playChirp: true
					});
				}, 2200);
			}
		});
	}

	const starBtns = document.querySelectorAll('.star-action-btn:not(#modalStarBtn)');
	starBtns.forEach(bindStarButton);

	// 12. Modal Synchronization Functions
	function syncModalSaveBtn(cardId) {
		if (!modalSaveBtn) return;
		const isSaved = savedMap[cardId] && savedMap[cardId].length > 0;
		const icon = modalSaveBtn.querySelector('i');
		if (isSaved) {
			modalSaveBtn.classList.add('active');
			if (icon) icon.className = 'fas fa-bookmark';
			if (modalSaveBtnText) modalSaveBtnText.textContent = 'Saved';
		} else {
			modalSaveBtn.classList.remove('active');
			if (icon) icon.className = 'far fa-bookmark';
			if (modalSaveBtnText) modalSaveBtnText.textContent = 'Save';
		}
	}

	function syncModalJoinBtn(cardId) {
		if (!modalJoinBtn) return;
		const isJoined = joinedList.includes(cardId);
		const icon = modalJoinBtn.querySelector('i');
		if (isJoined) {
			modalJoinBtn.classList.add('joined');
			if (icon) icon.className = 'fas fa-check';
			if (modalJoinBtnText) modalJoinBtnText.textContent = 'Joined Project';
		} else {
			modalJoinBtn.classList.remove('joined');
			if (icon) icon.className = 'fas fa-rocket';
			if (modalJoinBtnText) modalJoinBtnText.textContent = 'Join Project';
		}
	}

	// 13. Project Modal Inspection Handler
	function openProjectModal(card) {
		if (!projectModal || !card) return;
		currentOpenCard = card;
		const cardId = card.getAttribute('data-id') || card.id;
		const title = card.dataset.title || card.querySelector('.idea-title, .spotlight-title')?.textContent || '';
		const desc = card.dataset.desc || card.querySelector('.idea-description, .spotlight-desc')?.textContent || '';
		const author = card.dataset.author || card.querySelector('.creator-name')?.textContent || '';
		const avatar = card.dataset.avatar || card.querySelector('.creator-avatar')?.textContent || 'U';
		const time = card.dataset.time || card.querySelector('.idea-timestamp')?.textContent || '';
		const seeking = card.dataset.seeking || '';
		const tags = card.dataset.tags || '';

		if (modalTitle) modalTitle.textContent = title;
		if (modalDesc) modalDesc.textContent = desc;
		if (modalAuthor) modalAuthor.textContent = author;
		if (modalAvatar) modalAvatar.textContent = avatar;
		if (modalTime) modalTime.textContent = time;

		// Tags wrap
		if (modalTags) {
			modalTags.innerHTML = '';
			if (tags) {
				tags.split(',').forEach(tag => {
					const pill = document.createElement('span');
					pill.className = 'role-pill';
					pill.textContent = tag.trim();
					modalTags.appendChild(pill);
				});
			}
		}

		// Seeking roles
		if (modalSeeking) {
			modalSeeking.innerHTML = '<span class="seeking-label">Seeking:</span>';
			if (seeking) {
				seeking.split(',').forEach(role => {
					const pill = document.createElement('span');
					pill.className = 'role-pill';
					pill.textContent = role.trim();
					modalSeeking.appendChild(pill);
				});
			}
		}

		// Sync star button (supports both idea-card and spotlight-card)
		const cardStarBtn = card.querySelector('.star-action-btn');
		if (modalStarBtn) {
			let isStarred = false;
			let starCount = '0';
			if (cardStarBtn) {
				isStarred = cardStarBtn.classList.contains('active');
				starCount = cardStarBtn.querySelector('.star-count')?.textContent || '0';
			} else {
				const spotlightCount = card.querySelector('.spotlight-star-count');
				starCount = spotlightCount ? spotlightCount.textContent.replace(/[^0-9]/g, '') : '512';
			}
			modalStarBtn.className = 'star-action-btn' + (isStarred ? ' active' : '');
			modalStarBtn.innerHTML = `<i class="${isStarred ? 'fas' : 'far'} fa-star"></i> <span class="star-count">${starCount}</span> Stars`;
		}

		// Sync top save button and join button
		syncModalSaveBtn(cardId);
		syncModalJoinBtn(cardId);

		projectModal.classList.add('active');
		document.body.style.overflow = 'hidden';
	}

	if (projectModal) {
		document.querySelectorAll('.idea-card, .spotlight-card').forEach(card => {
			card.addEventListener('click', (e) => {
				if (e.target.closest('button')) return;
				openProjectModal(card);
			});
		});

		// Modal Top Save Button Click
		if (modalSaveBtn) {
			modalSaveBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				if (currentOpenCard) {
					const cardId = currentOpenCard.getAttribute('data-id') || currentOpenCard.id;
					if (cardId) toggleIdeaSave(cardId);
				}
			});
		}

		// Modal Join Button Click
		if (modalJoinBtn) {
			modalJoinBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				if (currentOpenCard) {
					const cardId = currentOpenCard.getAttribute('data-id') || currentOpenCard.id;
					if (cardId) toggleIdeaJoin(cardId);
				}
			});
		}

		// Modal Star Button Click
		if (modalStarBtn) {
			modalStarBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				const countSpan = modalStarBtn.querySelector('.star-count');
				const starIcon = modalStarBtn.querySelector('i');
				let count = parseInt(countSpan?.textContent, 10) || 0;
				const isCurrentlyActive = modalStarBtn.classList.contains('active');

				if (isCurrentlyActive) {
					modalStarBtn.classList.remove('active');
					if (starIcon) starIcon.className = 'far fa-star';
					count = Math.max(0, count - 1);
				} else {
					modalStarBtn.classList.add('active');
					if (starIcon) starIcon.className = 'fas fa-star';
					count = count + 1;

					// Instant chirp + creator echo after 2.2s
					playChirpSound();
					if (currentOpenCard) {
						const cardId = currentOpenCard.getAttribute('data-id') || currentOpenCard.id;
						const author = currentOpenCard.dataset?.author || currentOpenCard.querySelector('.creator-name')?.textContent?.trim() || '@creator';
						const title = currentOpenCard.dataset?.title || currentOpenCard.querySelector('.idea-title')?.textContent?.trim() || 'Blueprint';
						const authorAvatar = currentOpenCard.dataset?.avatar || currentOpenCard.querySelector('.creator-avatar')?.textContent?.trim() || author.charAt(1).toUpperCase();

						setTimeout(() => {
							addNotification({
								type: 'spark',
								actor: author,
								avatar: authorAvatar,
								avatarBg: 'linear-gradient(135deg, rgba(251, 191, 36, 0.4), rgba(245, 158, 11, 0.2))',
								icon: 'fa-bolt',
								iconColor: '#fbbf24',
								text: 'appreciated your spark on',
								targetTitle: title,
								ideaId: cardId,
								playChirp: true
							});
						}, 2200);
					}
				}
				if (countSpan) countSpan.textContent = count;

				// Sync card
				if (currentOpenCard) {
					const cardStarBtn = currentOpenCard.querySelector('.star-action-btn');
					if (cardStarBtn) {
						const cardCountSpan = cardStarBtn.querySelector('.star-count');
						const cardIcon = cardStarBtn.querySelector('i');
						if (!isCurrentlyActive) {
							cardStarBtn.classList.add('active');
							if (cardIcon) cardIcon.className = 'fas fa-star';
						} else {
							cardStarBtn.classList.remove('active');
							if (cardIcon) cardIcon.className = 'far fa-star';
						}
						if (cardCountSpan) cardCountSpan.textContent = count;
					}
				}
			});
		}

		// Close Modal Functions
		function closeModal() {
			projectModal.classList.remove('active');
			document.body.style.overflow = '';
			currentOpenCard = null;
		}

		if (modalCloseBtn) {
			modalCloseBtn.addEventListener('click', closeModal);
		}

		projectModal.addEventListener('click', (e) => {
			if (e.target === projectModal) {
				closeModal();
			}
		});

		window.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && projectModal.classList.contains('active')) {
				closeModal();
			}
		});
	}

	// 14. Create New Collection Modal Logic
	let selectedIcon = 'fa-folder';

	if (btnOpenAddCollectionModal && collectionModal) {
		btnOpenAddCollectionModal.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			collectionModal.classList.add('active');
			document.body.style.overflow = 'hidden';
			if (collectionNameInput) {
				collectionNameInput.value = '';
				setTimeout(() => collectionNameInput.focus(), 100);
			}
		});

		function closeCollectionModal() {
			collectionModal.classList.remove('active');
			document.body.style.overflow = '';
		}

		if (collectionModalCloseBtn) {
			collectionModalCloseBtn.addEventListener('click', closeCollectionModal);
		}
		if (collectionModalCancelBtn) {
			collectionModalCancelBtn.addEventListener('click', closeCollectionModal);
		}

		collectionModal.addEventListener('click', (e) => {
			if (e.target === collectionModal) {
				closeCollectionModal();
			}
		});

		// Icon picker selection
		if (collectionIconPicker) {
			const iconBtns = collectionIconPicker.querySelectorAll('.icon-choice-btn');
			iconBtns.forEach(btn => {
				btn.addEventListener('click', () => {
					iconBtns.forEach(b => b.classList.remove('active'));
					btn.classList.add('active');
					selectedIcon = btn.getAttribute('data-icon') || 'fa-folder';
				});
			});
		}

		// Form submission
		if (createCollectionForm) {
			createCollectionForm.addEventListener('submit', (e) => {
				e.preventDefault();
				const name = collectionNameInput.value.trim();
				if (!name) return;

				const id = 'col-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
				userCollections.push({
					id,
					name,
					icon: selectedIcon
				});

				persistState();
				renderCollectionsSidebar();
				closeCollectionModal();

				addNotification({
					type: 'milestone',
					actor: 'IDEATE_SYS',
					avatar: 'M',
					avatarBg: 'linear-gradient(135deg, rgba(56, 189, 248, 0.4), rgba(14, 165, 233, 0.2))',
					icon: 'fa-folder-plus',
					iconColor: '#38bdf8',
					text: 'created custom collection',
					pill: name,
					targetTitle: 'in your telemetry hub',
					playChirp: true
				});

				// Automatically switch to the newly created collection
				const newLink = document.querySelector(`.collection-link[data-collection="${id}"]`);
				if (newLink) {
					document.querySelectorAll('.collection-link').forEach(l => l.classList.remove('active'));
					themeLinks.forEach(l => l.classList.remove('active'));
					newLink.classList.add('active');
					activeCollection = id;
					activeTheme = 'all';
					runAnimatedFilter();
				}
			});
		}
	}

	// 15. Native Gesture-Driven Pull-to-Refresh with Threshold Logic
	if (feedContainer) {
		const pullSpinner = document.createElement('div');
		pullSpinner.className = 'feed-pull-spinner';
		pullSpinner.innerHTML = '<i class="fas fa-arrows-rotate"></i>';
		feedContainer.prepend(pullSpinner);

		const PULL_THRESHOLD = 70;
		let touchStartY = 0;
		let currentPullDistance = 0;
		let isRefreshing = false;

		function executeReload() {
			if (isRefreshing) return;
			isRefreshing = true;
			pullSpinner.classList.add('visible', 'refreshing');
			pullSpinner.style.transform = 'translateX(-50%) translateY(15px) scale(1)';
			setTimeout(() => {
				window.location.reload();
			}, 400);
		}

		feedContainer.addEventListener('touchstart', (e) => {
			if (feedContainer.scrollTop <= 0) {
				touchStartY = e.touches[0].clientY;
				currentPullDistance = 0;
			}
		}, { passive: true });

		feedContainer.addEventListener('touchmove', (e) => {
			if (isRefreshing || feedContainer.scrollTop > 0) return;
			const touchY = e.touches[0].clientY;
			const deltaY = touchY - touchStartY;

			if (deltaY > 0) {
				currentPullDistance = Math.min(100, deltaY * 0.45);
				if (currentPullDistance > 15) {
					pullSpinner.classList.add('visible');
					const progressRotation = (currentPullDistance / PULL_THRESHOLD) * 240;
					pullSpinner.style.transform = `translateX(-50%) translateY(${currentPullDistance - 45}px) rotate(${progressRotation}deg)`;
				} else {
					pullSpinner.classList.remove('visible');
				}
			}
		}, { passive: true });

		feedContainer.addEventListener('touchend', () => {
			if (isRefreshing) return;
			if (currentPullDistance >= PULL_THRESHOLD && feedContainer.scrollTop <= 0) {
				executeReload();
			} else {
				pullSpinner.classList.remove('visible');
				pullSpinner.style.transform = '';
				currentPullDistance = 0;
			}
		});
	}

		// 16. Full Idea Spawner Modal & 3D Flip Engine
	const spawnIdeaModal = document.getElementById('spawnIdeaModal');
	const spawnFlipperCard = document.getElementById('spawnFlipperCard');
	const btnOpenSpawnModal = document.getElementById('btnOpenSpawnModal');
	const spawnModalCloseBtn = document.getElementById('spawnModalCloseBtn');
	const spawnModalCancelBtn = document.getElementById('spawnModalCancelBtn');
	const spawnPreviewCloseBtn = document.getElementById('spawnPreviewCloseBtn');
	const btnFlipToPreview = document.getElementById('btnFlipToPreview');
	const btnFlipBackToEdit = document.getElementById('btnFlipBackToEdit');
	const btnPreviewCancel = document.getElementById('btnPreviewCancel');
	const btnPreviewBroadcast = document.getElementById('btnPreviewBroadcast');
	const spawnIdeaForm = document.getElementById('spawnIdeaForm');
	const spawnTitleInput = document.getElementById('spawnTitleInput');
	const spawnDescInput = document.getElementById('spawnDescInput');
	const spawnDescCount = document.getElementById('spawnDescCount');
	const spawnSelectedTheme = document.getElementById('spawnSelectedTheme');
	const spawnThemePicker = document.getElementById('spawnThemePicker');
	const spawnTagInput = document.getElementById('spawnTagInput');
	const spawnTagsList = document.getElementById('spawnTagsList');
	const spawnRoleInput = document.getElementById('spawnRoleInput');
	const spawnRolesList = document.getElementById('spawnRolesList');
	const spawnerTextarea = document.getElementById('spawnerTextarea');
	const tagChips = document.querySelectorAll('.tag-btn-chip');

	// Preview Elements on Back Face
	const prevTitle = document.getElementById('prevTitle');
	const prevDesc = document.getElementById('prevDesc');
	const prevThemeBadge = document.getElementById('prevThemeBadge');
	const prevRolesList = document.getElementById('prevRolesList');
	const prevTagsWrap = document.getElementById('prevTagsWrap');
	const prevSeekingWrap = document.getElementById('prevSeekingWrap');

	const THEME_NAMES = {
		'ai-ml': 'AI & Machine Learning',
		'quantum-bio': 'Quantum & Bio-Tech',
		'hardware-robotics': 'Hardware & Robotics',
		'cybersecurity': 'Cybersecurity & Privacy',
		'system-design': 'Distributed Systems',
		'web-cloud': 'Web3 & Cloud Edge',
		'mobile-apps': 'Mobile Applications'
	};

	let currentSpawnTags = ['Rust', 'WebAssembly'];
	let currentSpawnRoles = ['Embedded Rust', 'Signal Processing'];

	function renderSpawnTags() {
		if (!spawnTagsList) return;
		spawnTagsList.innerHTML = '';
		currentSpawnTags.forEach((t, idx) => {
			const pill = document.createElement('span');
			pill.className = 'spawn-tag-pill';
			pill.innerHTML = `<span>${escapeHtml(t)}</span><i class="fas fa-xmark spawn-tag-remove" data-type="tag" data-idx="${idx}" title="Remove tag"></i>`;
			spawnTagsList.appendChild(pill);
		});
		updateSpawnPreview();
	}

	function renderSpawnRoles() {
		if (!spawnRolesList) return;
		spawnRolesList.innerHTML = '';
		currentSpawnRoles.forEach((r, idx) => {
			const pill = document.createElement('span');
			pill.className = 'spawn-tag-pill';
			pill.innerHTML = `<span>${escapeHtml(r)}</span><i class="fas fa-xmark spawn-tag-remove" data-type="role" data-idx="${idx}" title="Remove role"></i>`;
			spawnRolesList.appendChild(pill);
		});
		updateSpawnPreview();
	}

	function updateSpawnPreview() {
		if (!prevTitle) return;
		const title = spawnTitleInput?.value.trim() || 'Untitled Impossible Mechanism';
		const desc = spawnDescInput?.value.trim() || 'Describe the impossible mechanism, why it must exist, and what barrier prevented it from being built...';
		const theme = spawnSelectedTheme?.value || 'ai-ml';

		prevTitle.textContent = title;
		prevDesc.textContent = desc;

		if (prevThemeBadge) {
			prevThemeBadge.textContent = THEME_NAMES[theme] || 'AI & Machine Learning';
		}

		if (prevRolesList) {
			prevRolesList.innerHTML = '';
			if (currentSpawnRoles.length > 0) {
				currentSpawnRoles.forEach(r => {
					const pill = document.createElement('span');
					pill.className = 'role-pill';
					pill.textContent = r;
					prevRolesList.appendChild(pill);
				});
				if (prevSeekingWrap) prevSeekingWrap.style.display = 'flex';
			} else {
				if (prevSeekingWrap) prevSeekingWrap.style.display = 'none';
			}
		}

		if (prevTagsWrap) {
			prevTagsWrap.innerHTML = '';
			currentSpawnTags.forEach(t => {
				const pill = document.createElement('span');
				pill.className = 'prev-tag-pill';
				pill.textContent = '#' + t;
				prevTagsWrap.appendChild(pill);
			});
		}
	}

	// 3D Card Flip Handler
	function flipSpawnCard(toPreview) {
		if (!spawnFlipperCard) return;
		if (toPreview) {
			updateSpawnPreview();
			spawnFlipperCard.classList.add('is-flipped');
			playChirpSound(700, 1500, 0.08);
		} else {
			spawnFlipperCard.classList.remove('is-flipped');
			playChirpSound(1500, 700, 0.08);
		}
	}

	renderSpawnTags();
	renderSpawnRoles();

	// Flip buttons
	if (btnFlipToPreview) {
		btnFlipToPreview.addEventListener('click', (e) => {
			e.preventDefault();
			flipSpawnCard(true);
		});
	}

	if (btnFlipBackToEdit) {
		btnFlipBackToEdit.addEventListener('click', (e) => {
			e.preventDefault();
			flipSpawnCard(false);
		});
	}

	if (btnPreviewCancel) {
		btnPreviewCancel.addEventListener('click', (e) => {
			e.preventDefault();
			flipSpawnCard(false);
		});
	}

	if (spawnPreviewCloseBtn) {
		spawnPreviewCloseBtn.addEventListener('click', (e) => {
			e.preventDefault();
			closeSpawnModal();
		});
	}

	if (btnPreviewBroadcast) {
		btnPreviewBroadcast.addEventListener('click', (e) => {
			e.preventDefault();
			if (spawnIdeaForm) {
				if (typeof spawnIdeaForm.requestSubmit === 'function') {
					spawnIdeaForm.requestSubmit();
				} else {
					const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
					spawnIdeaForm.dispatchEvent(submitEvent);
				}
			}
		});
	}

	// Live text syncing
	if (spawnTitleInput) {
		spawnTitleInput.addEventListener('input', updateSpawnPreview);
	}
	if (spawnDescInput) {
		spawnDescInput.addEventListener('input', () => {
			if (spawnDescCount) spawnDescCount.textContent = spawnDescInput.value.length;
			updateSpawnPreview();
		});
	}

	// Delegate tag & role pill removal
	if (spawnTagsList) {
		spawnTagsList.addEventListener('click', (e) => {
			const removeBtn = e.target.closest('.spawn-tag-remove');
			if (removeBtn) {
				const idx = parseInt(removeBtn.getAttribute('data-idx'), 10);
				if (!isNaN(idx)) {
					currentSpawnTags.splice(idx, 1);
					renderSpawnTags();
				}
			}
		});
	}

	if (spawnRolesList) {
		spawnRolesList.addEventListener('click', (e) => {
			const removeBtn = e.target.closest('.spawn-tag-remove');
			if (removeBtn) {
				const idx = parseInt(removeBtn.getAttribute('data-idx'), 10);
				if (!isNaN(idx)) {
					currentSpawnRoles.splice(idx, 1);
					renderSpawnRoles();
				}
			}
		});
	}

	// Add tag on Enter or comma
	if (spawnTagInput) {
		spawnTagInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ',') {
				e.preventDefault();
				const val = spawnTagInput.value.replace(/,/g, '').trim();
				if (val && !currentSpawnTags.includes(val)) {
					currentSpawnTags.push(val);
					renderSpawnTags();
				}
				spawnTagInput.value = '';
			} else if (e.key === 'Backspace' && !spawnTagInput.value && currentSpawnTags.length > 0) {
				currentSpawnTags.pop();
				renderSpawnTags();
			}
		});
	}

	// Add role on Enter or comma
	if (spawnRoleInput) {
		spawnRoleInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ',') {
				e.preventDefault();
				const val = spawnRoleInput.value.replace(/,/g, '').trim();
				if (val && !currentSpawnRoles.includes(val)) {
					currentSpawnRoles.push(val);
					renderSpawnRoles();
				}
				spawnRoleInput.value = '';
			} else if (e.key === 'Backspace' && !spawnRoleInput.value && currentSpawnRoles.length > 0) {
				currentSpawnRoles.pop();
				renderSpawnRoles();
			}
		});
	}

	// Suggestion chips click
	document.querySelectorAll('.suggest-chip:not(.role-suggest)').forEach(chip => {
		chip.addEventListener('click', () => {
			const val = chip.getAttribute('data-value');
			if (val && !currentSpawnTags.includes(val)) {
				currentSpawnTags.push(val);
				renderSpawnTags();
			}
		});
	});

	document.querySelectorAll('.suggest-chip.role-suggest').forEach(chip => {
		chip.addEventListener('click', () => {
			const val = chip.getAttribute('data-value');
			if (val && !currentSpawnRoles.includes(val)) {
				currentSpawnRoles.push(val);
				renderSpawnRoles();
			}
		});
	});

	// Theme picker chips
	if (spawnThemePicker) {
		const themeChips = spawnThemePicker.querySelectorAll('.theme-choice-chip');
		themeChips.forEach(chip => {
			chip.addEventListener('click', () => {
				themeChips.forEach(c => c.classList.remove('active'));
				chip.classList.add('active');
				if (spawnSelectedTheme) {
					spawnSelectedTheme.value = chip.getAttribute('data-theme') || 'ai-ml';
				}
				updateSpawnPreview();
			});
		});
	}

	// Spawner Card quick tag chips
	tagChips.forEach(chip => {
		chip.addEventListener('click', () => {
			if (spawnerTextarea) {
				const tag = chip.textContent.trim();
				spawnerTextarea.value = (spawnerTextarea.value ? spawnerTextarea.value + ' ' : '') + tag + ' ';
				spawnerTextarea.focus();
			}
		});
	});

	// Modal Open & Close logic with 3D Flip Transition
	function openSpawnModal(initialText = '') {
		if (!spawnIdeaModal) return;
		if (initialText) {
			spawnDescInput.value = initialText;
		} else if (spawnerTextarea && spawnerTextarea.value.trim()) {
			spawnDescInput.value = spawnerTextarea.value.trim();
		}
		if (spawnDescCount && spawnDescInput) {
			spawnDescCount.textContent = spawnDescInput.value.length;
		}

		// Ensure it opens on front face with fresh preview data
		if (spawnFlipperCard) {
			spawnFlipperCard.classList.remove('is-flipped');
		}
		updateSpawnPreview();

		spawnIdeaModal.classList.add('active');
		document.body.style.overflow = 'hidden';
		playChirpSound(650, 1350, 0.07);

		if (spawnTitleInput) {
			setTimeout(() => spawnTitleInput.focus(), 140);
		}
	}

	function closeSpawnModal() {
		if (!spawnIdeaModal) return;
		spawnIdeaModal.classList.remove('active');
		document.body.style.overflow = '';
		// Reset flip state after transition completes
		setTimeout(() => {
			if (spawnFlipperCard) {
				spawnFlipperCard.classList.remove('is-flipped');
			}
		}, 380);
	}

	if (btnOpenSpawnModal) {
		btnOpenSpawnModal.addEventListener('click', () => openSpawnModal());
	}

	if (spawnModalCloseBtn) {
		spawnModalCloseBtn.addEventListener('click', closeSpawnModal);
	}

	if (spawnModalCancelBtn) {
		spawnModalCancelBtn.addEventListener('click', closeSpawnModal);
	}

	if (spawnIdeaModal) {
		spawnIdeaModal.addEventListener('click', (e) => {
			if (e.target === spawnIdeaModal || e.target.classList.contains('spawn-flipper-container')) {
				closeSpawnModal();
			}
		});
	}

	window.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && spawnIdeaModal && spawnIdeaModal.classList.contains('active')) {
			closeSpawnModal();
		}
		// Global shortcut 'c' opens spawner if not inside an input/textarea
		if ((e.key === 'c' || e.key === 'C') && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !document.querySelector('.project-modal-backdrop.active')) {
			e.preventDefault();
			openSpawnModal();
		}
	});

	// Form Submission: Broadcast blueprint to stream
	if (spawnIdeaForm) {
		spawnIdeaForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const title = spawnTitleInput?.value.trim();
			const desc = spawnDescInput?.value.trim();
			const theme = spawnSelectedTheme?.value || 'ai-ml';
			const tags = currentSpawnTags.slice();
			const seeking = currentSpawnRoles.slice();

			if (!title || !desc) {
				if (spawnFlipperCard && spawnFlipperCard.classList.contains('is-flipped')) {
					flipSpawnCard(false);
				}
				if (!title && spawnTitleInput) spawnTitleInput.focus();
				else if (!desc && spawnDescInput) spawnDescInput.focus();
				return;
			}

			const id = 'idea-custom-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
			const newIdea = {
				id,
				theme,
				title,
				desc,
				author: '@creator_01',
				avatar: 'M',
				time: 'Just now',
				seeking: seeking.join(', '),
				tags: tags.join(', '),
				stars: 1
			};

			// Save to custom ideas persistence
			customIdeas.unshift(newIdea);
			try {
				localStorage.setItem('ideate_custom_ideas', JSON.stringify(customIdeas));
			} catch (err) {
				console.error('Failed to persist custom idea:', err);
			}

			// Create DOM element and prepend to feed
			const cardElem = createIdeaCardElement(newIdea);
			if (feedContainer) {
				feedContainer.prepend(cardElem);
			}

			// Automatically switch to 'all' or matching theme so the new card is immediately visible
			if (activeTheme !== 'all' && activeTheme !== theme) {
				themeLinks.forEach(l => l.classList.remove('active'));
				const allThemeLink = document.querySelector('#themeNavList .sidebar-nav-link[data-theme="all"]');
				if (allThemeLink) allThemeLink.classList.add('active');
				activeTheme = 'all';
			}
			activeCollection = null;
			document.querySelectorAll('.collection-link').forEach(l => l.classList.remove('active'));

			runAnimatedFilter();

			// Telemetry notification & chirp
			addNotification({
				type: 'spawn',
				actor: 'YOU',
				avatar: 'M',
				avatarBg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.45), rgba(192, 132, 252, 0.2))',
				icon: 'fa-satellite-dish',
				iconColor: '#c084fc',
				text: 'broadcasted blueprint to stream:',
				targetTitle: title,
				ideaId: id,
				playChirp: true
			});

			// Reset inputs
			if (spawnTitleInput) spawnTitleInput.value = '';
			if (spawnDescInput) spawnDescInput.value = '';
			if (spawnerTextarea) spawnerTextarea.value = '';
			closeSpawnModal();

			// Smooth scroll to newly spawned blueprint
			setTimeout(() => {
				cardElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}, 200);
		});
	}


	// 17. Notifications Panel, Real-time Telemetry & Web Audio Chirp Engine
	const btnNotifications = document.getElementById('btnNotifications');
	const notificationsPanel = document.getElementById('notificationsPanel');
	const notificationsWrapper = document.getElementById('notificationsWrapper');
	const notifBadgeDot = document.getElementById('notifBadgeDot');
	const notifListContainer = document.getElementById('notifListContainer');
	const notifToastContainer = document.getElementById('notifToastContainer');
	const btnMarkAllRead = document.getElementById('btnMarkAllRead');
	const btnToggleNotifSound = document.getElementById('btnToggleNotifSound');
	const notifSoundIcon = document.getElementById('notifSoundIcon');
	const tabNotifAll = document.getElementById('tabNotifAll');
	const tabNotifUnread = document.getElementById('tabNotifUnread');
	const notifCountAll = document.getElementById('notifCountAll');
	const notifCountUnread = document.getElementById('notifCountUnread');

	// --- Sound & Web Audio API Synthesizer ---
	let isSoundEnabled = localStorage.getItem('ideate_notif_sound') !== 'disabled';
	let audioCtx = null;

	function updateSoundToggleUI() {
		if (!btnToggleNotifSound || !notifSoundIcon) return;
		if (isSoundEnabled) {
			btnToggleNotifSound.classList.remove('muted');
			btnToggleNotifSound.title = 'Mute telemetry audio chirp';
			notifSoundIcon.className = 'fas fa-volume-high';
		} else {
			btnToggleNotifSound.classList.add('muted');
			btnToggleNotifSound.title = 'Enable telemetry audio chirp';
			notifSoundIcon.className = 'fas fa-volume-xmark';
		}
	}

	function playChirpSound(startFreq = 1200, endFreq = 2600, duration = 0.065) {
		if (!isSoundEnabled) return;
		try {
			const AudioContext = window.AudioContext || window.webkitAudioContext;
			if (!AudioContext) return;
			if (!audioCtx) {
				audioCtx = new AudioContext();
			}
			if (audioCtx.state === 'suspended') {
				audioCtx.resume();
			}

			const osc = audioCtx.createOscillator();
			const gain = audioCtx.createGain();

			// Futuristic high-tech frequency sweep
			const now = audioCtx.currentTime;
			osc.type = 'sine';
			osc.frequency.setValueAtTime(startFreq, now);
			osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

			// Soft volume envelope: gentle attack, fast exponential decay
			gain.gain.setValueAtTime(0.0001, now);
			gain.gain.linearRampToValueAtTime(0.08, now + 0.012);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.06);

			osc.connect(gain);
			gain.connect(audioCtx.destination);

			osc.start(now);
			osc.stop(now + duration + 0.07);
		} catch (e) {
			// Silently ignore if audio context interaction not yet established
		}
	}

	if (btnToggleNotifSound) {
		btnToggleNotifSound.addEventListener('click', (e) => {
			e.stopPropagation();
			isSoundEnabled = !isSoundEnabled;
			localStorage.setItem('ideate_notif_sound', isSoundEnabled ? 'enabled' : 'disabled');
			updateSoundToggleUI();
			if (isSoundEnabled) {
				playChirpSound();
			}
		});
		updateSoundToggleUI();
	}

	// --- Real-time Floating Toast Alert ---
	function showNotifToast(notif) {
		if (!notifToastContainer) return;
		// Do not display toast banner if dropdown panel is actively open
		if (notificationsPanel && notificationsPanel.classList.contains('active')) return;

		const toast = document.createElement('div');
		toast.className = 'notif-toast';
		toast.setAttribute('role', 'alert');

		let descText = notif.targetTitle || notif.highlight || notif.pill || '';
		toast.innerHTML = `
			<div class="notif-toast-icon" style="color: ${notif.iconColor || 'var(--color-accent-violet)'};">
				<i class="fas ${notif.icon || 'fa-bell'}"></i>
			</div>
			<div class="notif-toast-body">
				<span class="notif-toast-tag">[ TELEMETRY ALERT ]</span>
				<div class="notif-toast-text">
					<strong>${notif.actor}</strong> ${notif.text} ${descText ? `"${descText}"` : ''}
				</div>
			</div>
		`;

		// Clicking toast opens notification panel
		toast.addEventListener('click', () => {
			openNotificationPanel();
			toast.remove();
		});

		notifToastContainer.appendChild(toast);

		// Auto dismiss after 3.8s
		setTimeout(() => {
			toast.classList.add('fade-out');
			setTimeout(() => {
				if (toast.parentNode) toast.remove();
			}, 250);
		}, 3800);
	}

	// --- State & Notifications Store ---
	const DEFAULT_NOTIFICATIONS = [
		{
			id: 'notif-1',
			type: 'star',
			actor: '@tensor_pioneer',
			avatar: 'A',
			avatarBg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(147, 51, 234, 0.2))',
			icon: 'fa-star',
			iconColor: '#fbbf24',
			text: 'starred your blueprint',
			targetTitle: 'Direct-Neural Optical Synthesizer',
			ideaId: 'idea-neural-coding',
			time: '4m ago',
			isRead: false
		},
		{
			id: 'notif-2',
			type: 'collab',
			actor: '@solar_nomad',
			avatar: 'S',
			avatarBg: 'linear-gradient(135deg, rgba(56, 189, 248, 0.35), rgba(14, 165, 233, 0.15))',
			icon: 'fa-user-plus',
			iconColor: '#38bdf8',
			text: 'requested to collaborate as',
			pill: 'Embedded Rust',
			targetTitle: 'Direct-Neural Optical Synthesizer',
			ideaId: 'idea-neural-coding',
			time: '28m ago',
			isRead: false
		},
		{
			id: 'notif-3',
			type: 'warroom',
			actor: '@crypto_cipher',
			avatar: 'K',
			avatarBg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.35), rgba(168, 85, 247, 0.2))',
			icon: 'fa-rocket',
			iconColor: '#a855f7',
			text: 'invited you to join the War Room for',
			targetTitle: 'Zero-Knowledge Real-Time Canvas',
			ideaId: 'idea-zk-canvas',
			time: '2h ago',
			isRead: false
		},
		{
			id: 'notif-4',
			type: 'milestone',
			actor: 'IDEATE_SYS',
			avatar: 'M',
			avatarBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(5, 150, 105, 0.2))',
			icon: 'fa-bolt',
			iconColor: '#10b981',
			text: 'Your creator node crossed',
			highlight: '1,240 Sparks',
			targetTitle: 'across the telemetry stream',
			ideaId: null,
			time: '1d ago',
			isRead: true
		},
		{
			id: 'notif-5',
			type: 'spawn',
			actor: '@neuro_architect',
			avatar: 'N',
			avatarBg: 'linear-gradient(135deg, rgba(192, 132, 252, 0.35), rgba(126, 34, 206, 0.2))',
			icon: 'fa-satellite-dish',
			iconColor: '#c084fc',
			text: 'spawned a new thought in',
			pill: 'Hardware & Robotics',
			targetTitle: 'Peer-to-Peer Neighborhood Micro-Battery Energy Routing',
			ideaId: 'idea-solar-mesh',
			time: '2d ago',
			isRead: true
		}
	];

	let notifications = [];
	try {
		const storedNotifs = localStorage.getItem('ideate_notifications');
		notifications = storedNotifs ? JSON.parse(storedNotifs) : DEFAULT_NOTIFICATIONS;
	} catch (e) {
		notifications = DEFAULT_NOTIFICATIONS;
	}

	let activeNotifTab = 'all'; // 'all' | 'unread'

	function persistNotifications() {
		try {
			localStorage.setItem('ideate_notifications', JSON.stringify(notifications));
		} catch (e) {
			console.error('Failed to persist notifications:', e);
		}
	}

	function addNotification({
		type = 'telemetry',
		actor = 'IDEATE_SYS',
		avatar = 'M',
		avatarBg = 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(147, 51, 234, 0.2))',
		icon = 'fa-bolt',
		iconColor = '#a855f7',
		text = '',
		pill = '',
		highlight = '',
		targetTitle = '',
		ideaId = null,
		playChirp = true
	}) {
		const id = 'notif-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 5);
		const newNotif = {
			id,
			type,
			actor,
			avatar,
			avatarBg,
			icon,
			iconColor,
			text,
			pill,
			highlight,
			targetTitle,
			ideaId,
			time: 'Just now',
			isRead: false
		};

		// Prepend to top of list
		notifications.unshift(newNotif);
		if (notifications.length > 30) {
			notifications.pop();
		}

		persistNotifications();
		renderNotifications();

		// Trigger visual pop animation on the badge dot
		if (notifBadgeDot) {
			notifBadgeDot.classList.remove('hidden');
			notifBadgeDot.classList.remove('ping');
			void notifBadgeDot.offsetWidth;
			notifBadgeDot.classList.add('ping');
		}

		// Show floating toast
		showNotifToast(newNotif);

		// Play high-tech audio chirp
		if (playChirp) {
			playChirpSound();
		}
	}

	function renderNotifications() {
		if (!notifListContainer) return;

		const totalCount = notifications.length;
		const unreadCount = notifications.filter(n => !n.isRead).length;

		if (notifCountAll) notifCountAll.textContent = totalCount;
		if (notifCountUnread) notifCountUnread.textContent = unreadCount;

		if (notifBadgeDot) {
			if (unreadCount > 0) {
				notifBadgeDot.classList.remove('hidden');
			} else {
				notifBadgeDot.classList.add('hidden');
			}
		}

		const filtered = notifications.filter(item => {
			if (activeNotifTab === 'unread') return !item.isRead;
			return true;
		});

		if (filtered.length === 0) {
			const isUnreadFilter = activeNotifTab === 'unread';
			notifListContainer.innerHTML = `
				<div class="notif-empty-state">
					<i class="fas ${isUnreadFilter ? 'fa-check-circle' : 'fa-bell-slash'} notif-empty-icon"></i>
					<div class="notif-empty-title">${isUnreadFilter ? 'ALL TELEMETRY READ' : 'NO NOTIFICATIONS'}</div>
					<div class="notif-empty-desc">${isUnreadFilter ? 'You have cleared all unread telemetry alerts.' : 'No notification telemetry recorded yet.'}</div>
				</div>
			`;
			return;
		}

		let html = '';
		filtered.forEach(item => {
			const unreadClass = item.isRead ? '' : 'unread';
			let extraHtml = '';
			if (item.pill) {
				extraHtml += ` <span class="notif-pill">${item.pill}</span>`;
			}
			if (item.highlight) {
				extraHtml += ` <span class="notif-highlight">${item.highlight}</span>`;
			}
			if (item.targetTitle) {
				extraHtml += ` <span class="notif-target">${item.targetTitle}</span>`;
			}

			html += `
				<div class="notif-item ${unreadClass}" data-id="${item.id}" ${item.ideaId ? `data-idea-id="${item.ideaId}"` : ''} role="button" tabindex="0">
					<div class="notif-avatar-wrap">
						<div class="notif-avatar" style="background: ${item.avatarBg};">${item.avatar}</div>
						<div class="notif-type-icon" style="color: ${item.iconColor};">
							<i class="fas ${item.icon}"></i>
						</div>
					</div>
					<div class="notif-body">
						<div class="notif-text">
							<span class="notif-actor">${item.actor}</span>
							<span>${item.text}</span>${extraHtml}
						</div>
						<div class="notif-time">
							<i class="far fa-clock"></i>
							<span>${item.time}</span>
						</div>
					</div>
				</div>
			`;
		});

		notifListContainer.innerHTML = html;

		// Bind click events on notification items
		notifListContainer.querySelectorAll('.notif-item').forEach(el => {
			el.addEventListener('click', () => {
				const id = el.getAttribute('data-id');
				const ideaId = el.getAttribute('data-idea-id');

				// Mark item as read
				const targetNotif = notifications.find(n => n.id === id);
				if (targetNotif && !targetNotif.isRead) {
					targetNotif.isRead = true;
					persistNotifications();
					renderNotifications();
				}

				// If connected to a project idea, navigate & open modal
				if (ideaId) {
					closeNotificationPanel();

					// If currently filtered out by theme or collection, reset to all themes
					if (activeTheme !== 'all' || activeCollection !== null) {
						themeLinks.forEach(l => l.classList.remove('active'));
						const allThemeLink = document.querySelector('#themeNavList .sidebar-nav-link[data-theme="all"]');
						if (allThemeLink) allThemeLink.classList.add('active');
						document.querySelectorAll('.collection-link').forEach(l => l.classList.remove('active'));
						activeTheme = 'all';
						activeCollection = null;
						runAnimatedFilter();
					}

					setTimeout(() => {
						const card = document.querySelector(`.idea-card[data-id="${ideaId}"], #${ideaId}`);
						if (card) {
							card.scrollIntoView({ behavior: 'smooth', block: 'center' });
							// Trigger project modal click
							card.click();
						}
					}, 150);
				}
			});
		});
	}

	function toggleNotificationPanel() {
		if (!notificationsPanel || !btnNotifications) return;
		const isOpen = notificationsPanel.classList.contains('active');
		if (isOpen) {
			closeNotificationPanel();
		} else {
			openNotificationPanel();
		}
	}

	function openNotificationPanel() {
		if (!notificationsPanel || !btnNotifications) return;
		notificationsPanel.classList.add('active');
		btnNotifications.classList.add('active');
		btnNotifications.setAttribute('aria-expanded', 'true');
		notificationsPanel.setAttribute('aria-hidden', 'false');
		playChirpSound();
		renderNotifications();
	}

	function closeNotificationPanel() {
		if (!notificationsPanel || !btnNotifications) return;
		notificationsPanel.classList.remove('active');
		btnNotifications.classList.remove('active');
		btnNotifications.setAttribute('aria-expanded', 'false');
		notificationsPanel.setAttribute('aria-hidden', 'true');
	}

	if (btnNotifications) {
		btnNotifications.addEventListener('click', (e) => {
			e.stopPropagation();
			toggleNotificationPanel();
		});
	}

	if (notificationsPanel) {
		notificationsPanel.addEventListener('click', (e) => {
			e.stopPropagation();
		});
	}

	if (btnMarkAllRead) {
		btnMarkAllRead.addEventListener('click', (e) => {
			e.stopPropagation();
			notifications.forEach(n => { n.isRead = true; });
			persistNotifications();
			renderNotifications();
		});
	}

	if (tabNotifAll) {
		tabNotifAll.addEventListener('click', (e) => {
			e.stopPropagation();
			activeNotifTab = 'all';
			tabNotifAll.classList.add('active');
			if (tabNotifUnread) tabNotifUnread.classList.remove('active');
			renderNotifications();
		});
	}

	if (tabNotifUnread) {
		tabNotifUnread.addEventListener('click', (e) => {
			e.stopPropagation();
			activeNotifTab = 'unread';
			tabNotifUnread.classList.add('active');
			if (tabNotifAll) tabNotifAll.classList.remove('active');
			renderNotifications();
		});
	}

	// Close on click outside
	document.addEventListener('click', (e) => {
		if (notificationsPanel && notificationsPanel.classList.contains('active')) {
			if (!notificationsWrapper || !notificationsWrapper.contains(e.target)) {
				closeNotificationPanel();
			}
		}
	});

	// Close on Escape key
	window.addEventListener('keydown', (e) => {
		if (e.key === 'Escape' && notificationsPanel && notificationsPanel.classList.contains('active')) {
			closeNotificationPanel();
			if (btnNotifications) btnNotifications.focus();
		}
	});

	// --- Simulated Network Telemetry Stream (Live Peer Activity) ---
	const SIMULATED_STREAM_EVENTS = [
		{
			type: 'star',
			actor: '@tensor_pioneer',
			avatar: 'A',
			avatarBg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.4), rgba(147, 51, 234, 0.2))',
			icon: 'fa-star',
			iconColor: '#fbbf24',
			text: 'starred your blueprint',
			targetTitle: 'Direct-Neural Optical Synthesizer',
			ideaId: 'idea-neural-coding'
		},
		{
			type: 'collab',
			actor: '@solar_nomad',
			avatar: 'S',
			avatarBg: 'linear-gradient(135deg, rgba(56, 189, 248, 0.35), rgba(14, 165, 233, 0.15))',
			icon: 'fa-user-plus',
			iconColor: '#38bdf8',
			text: 'requested to collaborate as',
			pill: 'Signal Processing Specialist',
			targetTitle: 'Direct-Neural Optical Synthesizer',
			ideaId: 'idea-neural-coding'
		},
		{
			type: 'warroom',
			actor: '@crypto_cipher',
			avatar: 'K',
			avatarBg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.35), rgba(168, 85, 247, 0.2))',
			icon: 'fa-rocket',
			iconColor: '#a855f7',
			text: 'pushed a new blueprint update in',
			targetTitle: 'Zero-Knowledge Real-Time Canvas',
			ideaId: 'idea-zk-canvas'
		},
		{
			type: 'spawn',
			actor: '@neuro_architect',
			avatar: 'N',
			avatarBg: 'linear-gradient(135deg, rgba(192, 132, 252, 0.35), rgba(126, 34, 206, 0.2))',
			icon: 'fa-satellite-dish',
			iconColor: '#c084fc',
			text: 'spawned a new thought in',
			pill: 'Quantum & Bio-Tech',
			targetTitle: 'Sub-Kelvin Distributed Qubit Simulator',
			ideaId: null
		},
		{
			type: 'milestone',
			actor: 'IDEATE_SYS',
			avatar: 'M',
			avatarBg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.4), rgba(5, 150, 105, 0.2))',
			icon: 'fa-bolt',
			iconColor: '#10b981',
			text: 'Telemetry stream: 14 new thought sparks recorded in',
			pill: 'AI & Machine Learning',
			targetTitle: 'today'
		}
	];

	let streamEventIndex = 0;
	function triggerSimulatedNetworkTelemetry() {
		const event = SIMULATED_STREAM_EVENTS[streamEventIndex % SIMULATED_STREAM_EVENTS.length];
		streamEventIndex++;
		addNotification({
			...event,
			playChirp: true
		});
	}

	// First simulated live event arrives after 12s, then every 50s
	setTimeout(() => {
		triggerSimulatedNetworkTelemetry();
		setInterval(triggerSimulatedNetworkTelemetry, 50000);
	}, 12000);

	// Initial render of notifications
	renderNotifications();

	// Initial render of collections sidebar
	renderCollectionsSidebar();
});
