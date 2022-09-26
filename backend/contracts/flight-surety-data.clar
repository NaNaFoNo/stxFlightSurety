
;; flight-surety-data
;; <add a description here>
(impl-trait .data-trait.data-storage-trait)

(define-constant err-unauthorised (err u2001))
(define-constant not-whitelisted (err u2002))

(define-constant contract-owner tx-sender)

(define-data-var number uint u0)

(define-map whitelisted-contracts principal bool)

(define-read-only (is-whitelisted (app-contract principal))
	(default-to false (map-get? whitelisted-contracts app-contract))
)

(define-public (set-whitelisted (app-contract principal) (whitelisted bool))
	(begin
		(asserts! (is-eq contract-owner tx-sender) err-unauthorised)
		(ok (map-set whitelisted-contracts app-contract whitelisted))
	)
)


;; private functions
;;

;; public functions
;;
(define-public (check-connection (sender principal))
  (begin
    (asserts! (is-whitelisted sender) not-whitelisted)
    (ok {sender: tx-sender, contract: (as-contract tx-sender)})
  )
)

(define-public (count) 
  (let 
    (
      (state (+ (var-get number) u1))
    )
    (var-set number state)
    (ok state)
  )
)


