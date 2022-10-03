
;; flight-surety-data
;; <add a description here>
;;(impl-trait .data-trait.data-storage-trait)

;; error consts
;;
(define-constant ERR_UNAUTHORISED (err u1001))
(define-constant NOT_WHITELISTED (err u1002))

(define-constant AIRLINE_NOT_FOUND (err u2001))
(define-constant BAD_AIRLINE_STATUS (err u2002))
(define-constant AIRLINE_ALREADY_REGISTERED (err u2003))

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
    voters:  (list 25 principal),
  }
)


;; add first ariline
(map-set airlines 
  'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5 
  {
    airline-state: u2,
    airline-name: "First Airline",
    voters: (list ),
  }  
)
(var-set registeredAirlines u1)


;; private functions
;;
(define-private (is-airline (address principal)) (> (unwrap-panic (get airline-state (map-get? airlines address))) u1)
  ;;(let 
  ;;  (
  ;;    (status (get airline-state (unwrap! (map-get? airlines address) AIRLINE_NOT_FOUND)))
  ;;  ) 
  ;;  (ok (> status u1))
  ;;)
)

(define-private (register-airline-init (airline principal) (airlineName (string-ascii 40)) (caller principal)) 
  (begin
    (map-set airlines airline {
      airline-state: u1,
      airline-name: airlineName,
      voters:  (list caller) ,
    })
    (ok "Airline accepted for application")
  )
)

(define-private (register-airline-vote (airline principal) (caller principal)) 
  (let 
    (
      (airlineData (unwrap-panic (map-get? airlines airline)))
      (voters (get voters airlineData))
      (newVotes (append (list ) voters) )
      (output 
        (merge airlineData
          {
            voters: (unwrap-panic (as-max-len? (append voters caller) u25)) ,
          }
        )
      )
    )
    (map-set airlines airline output)
    (ok "Airline vote registered")
  )
)



;; public functions
;;
;; whitelisting
(define-read-only (is-whitelisted (app-contract principal))
	(default-to false (map-get? authorizedCallers app-contract))
)

(define-public (set-whitelisted (appContract principal) (whitelisted bool))
	(begin
		(asserts! (is-eq CONTRACT_OWNER tx-sender) ERR_UNAUTHORISED)
    ;; #[filter(appContract, whitelisted)]
		(ok (map-set authorizedCallers appContract whitelisted))
	)
)
;; airlines
(define-read-only (get-airlines-count) 
  (var-get registeredAirlines)
)
(define-read-only (get-airline (airline principal)) 
  (map-get? airlines airline)
)


;; new airline airline State 0 = Init, Voting 1 = Application

(define-public (register-airline (airline principal) (airlineName (string-ascii 30)) (caller principal) (airlineState uint)) 
  (let
    (
      (airlineData (map-get? airlines airline))
    ) 
    (if (is-eq u0 airlineState)
      ;; #[filter(airline, airlineName, caller)]
      (register-airline-init airline airlineName caller) 
      (register-airline-vote airline caller) 
    )
  )
)

(define-read-only (get-airline-status (airlineAddress principal))
  (let 
    (
      (status (get airline-state (unwrap! (map-get? airlines airlineAddress) AIRLINE_NOT_FOUND)))
    ) 
    (ok (unwrap! (element-at AIRLINE_STATE status) BAD_AIRLINE_STATUS))
  )
)

(define-read-only (test-airline (address principal))
  (begin 
    (asserts! (is-some (map-get? airlines address)) (err u1234))
    (ok (is-airline address))
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


