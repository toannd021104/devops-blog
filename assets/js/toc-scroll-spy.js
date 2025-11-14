// Table of Contents Scroll Spy
// Highlights the current section in ToC as user scrolls

document.addEventListener('DOMContentLoaded', function() {
    const tocLinks = document.querySelectorAll('.toc a');
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

    if (tocLinks.length === 0 || headings.length === 0) {
        return; // No ToC or headings found
    }

    // Create a map of heading IDs to ToC links
    const headingToLink = new Map();
    tocLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
            const id = href.substring(1);
            headingToLink.set(id, link);
        }
    });

    // Intersection Observer options
    const observerOptions = {
        root: null,
        rootMargin: '-100px 0px -66%',
        threshold: 0
    };

    // Track currently active heading
    let activeHeading = null;

    // Intersection Observer callback
    const observerCallback = (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                const link = headingToLink.get(id);

                if (link) {
                    // Remove active class from all links
                    tocLinks.forEach(l => l.classList.remove('active'));

                    // Add active class to current link
                    link.classList.add('active');

                    // Auto-scroll ToC to show active item
                    const toc = document.querySelector('.toc');
                    if (toc) {
                        const linkTop = link.offsetTop;
                        const tocScrollTop = toc.scrollTop;
                        const tocHeight = toc.clientHeight;
                        const linkHeight = link.clientHeight;

                        // Scroll if link is not visible
                        if (linkTop < tocScrollTop || linkTop + linkHeight > tocScrollTop + tocHeight) {
                            link.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                        }
                    }

                    activeHeading = id;
                }
            }
        });
    };

    // Create observer
    const observer = new IntersectionObserver(observerCallback, observerOptions);

    // Observe all headings that have an ID
    headings.forEach(heading => {
        if (heading.hasAttribute('id')) {
            observer.observe(heading);
        }
    });

    // Handle ToC link clicks for smooth scrolling
    tocLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            if (href && href.startsWith('#')) {
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });

                    // Update URL hash without jumping
                    if (history.pushState) {
                        history.pushState(null, null, href);
                    } else {
                        location.hash = href;
                    }
                }
            }
        });
    });
});
