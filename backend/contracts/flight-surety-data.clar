
;; flight-surety-data
;; <add a description here>
;;(impl-trait .data-trait.data-storage-trait)

;; error consts
;;
(define-constant ERR_UNAUTHORISED (err u1001))
(define-constant NOT_WHITELISTED (err u1002))

(define-constant AIRLINE_NOT_FOUND (err u2001))
(define-constant BAD_AIRLINE_STATUS (err u2002))

;; constants
;;
(define-constant CONTRACT_OWNER tx-sender)
(define-constant AIRLINE_STATE 
  (list "Init" "Application" "Registered" "Funded")
)

;; data maps and vars
;;
(define-data-var authAirlines uint u0)  ;; Airlines authoriyed for consensus voting
(define-data-var registeredAirlines uint u0) ;; Airlines registered

(define-map authorizedCallers principal bool)
(define-map airlines 
  principal 
  { 
    airline-state: uint,
    airline-name: (string-ascii 40),
    voters: (list 25 { voter: principal, vote: bool}),
    votes: uint,
  }
)

;; add first ariline
(map-set airlines 
  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5 
  {
    airline-state: u2,
    airline-name: "First Airline",
    voters: (list ),
    votes: u0,
  }  
)
(var-set registeredAirlines u1)


;; private functions
;;
(define-public (is-airline (address principal)) 
  (let 
    (
      (status (get airline-state (unwrap! (map-get? airlines address) AIRLINE_NOT_FOUND)))
    ) 
    (ok (> status u1))
  )
)


;; public functions
;;
;; whitelisting
(define-read-only (is-whitelisted (app-contract principal))
	(default-to false (map-get? authorizedCallers app-contract))
)

(define-public (set-whitelisted (app-contract principal) (whitelisted bool))
	(begin
		(asserts! (is-eq CONTRACT_OWNER tx-sender) ERR_UNAUTHORISED)
    ;; #[filter(app-contract, whitelisted)]
		(ok (map-set authorizedCallers app-contract whitelisted))
	)
)
;; airlines
(define-read-only (get-airlines-count) 
  (var-get registeredAirlines)
)

(define-read-only (get-airline-status (airline-address principal))
  (let 
    (
      (status (get airline-state (unwrap! (map-get? airlines airline-address) AIRLINE_NOT_FOUND)))
    ) 
    (ok (unwrap! (element-at AIRLINE_STATE status) BAD_AIRLINE_STATUS))
  )
  
)
;;(contract-call? .flight-surety-data get-airline-status 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
;;(define-public (check-connection (sender principal))
;;  (begin
;;    (asserts! (is-whitelisted sender) not-whitelisted)
;;    (ok {sender: tx-sender, contract: (as-contract tx-sender)})
;;  )
;;)
;;
;;(define-public (count) 
;;  (let 
;;    (
;;      (state (+ (var-get number) u1))
;;    )
;;    (var-set number state)
;;    (ok state)
;;  )
;;)


