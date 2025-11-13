// Live search functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('live-search-input');
    const postEntries = document.querySelectorAll('.post-entry:not(.first-entry)');
    const noResults = document.getElementById('no-results');

    if (!searchInput || postEntries.length === 0) return;

    searchInput.addEventListener('input', function(e) {
        const searchTerm = e.target.value.toLowerCase().trim();
        let visibleCount = 0;

        postEntries.forEach(function(post) {
            const title = post.querySelector('.entry-header h2')?.textContent.toLowerCase() || '';
            const content = post.querySelector('.entry-content')?.textContent.toLowerCase() || '';
            const footer = post.querySelector('.entry-footer')?.textContent.toLowerCase() || '';

            const matches = title.includes(searchTerm) ||
                          content.includes(searchTerm) ||
                          footer.includes(searchTerm);

            if (searchTerm === '' || matches) {
                post.classList.remove('hidden');
                visibleCount++;
            } else {
                post.classList.add('hidden');
            }
        });

        // Show/hide no results message
        if (noResults) {
            if (visibleCount === 0 && searchTerm !== '') {
                noResults.classList.add('show');
            } else {
                noResults.classList.remove('show');
            }
        }
    });
});
