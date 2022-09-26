(define-trait data-storage-trait
    (
        (check-connection (principal) (response (tuple (sender principal) (contract principal)) uint))
        (count () (response uint uint))
        ;; And the rest of the functions...
    )
)