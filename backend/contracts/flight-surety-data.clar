
;; flight-surety-data
;; <add a description here>


;; error consts   ;;;********* mainly handled by app, keep only data related no logic
;;
(define-constant ERR_UNAUTHORISED (err u2011))
(define-constant NOT_WHITELISTED (err u2012))

;; constants
;;
(define-constant CONTRACT_OWNER tx-sender)
(define-constant CONTRACT_ADDRESS (as-contract tx-sender))

;; data maps and vars
;;
(define-data-var registeredAirlines uint u0) ;; Airlines registered
(define-data-var idCounter uint u0)  ;; Airlines ID counter
(define-data-var registeredFlights uint u0) ;; Flights registered

(define-map AuthorizedCallers principal bool)
(define-map Airlines 
  principal 
  { 
    airline-id: uint,
    airline-state: uint,
    airline-name: (string-ascii 40),
    voters:  (list 25 principal),
  }
)

(define-map Flights 
  { flight-id: (string-ascii 7), airline-id: uint } 
  { 
    active: bool,
    status-code: (list 4 uint),
    payout: (list 4 uint),
    max-payout: uint,
  }
)

;; verify if funded state or something els should be added ----> has to be checked in tests, not done yet
(define-map RegisteredAirlines uint principal)   ;; < implement , could be useful .... done for airline deployment, contract logic tbd
(define-map RegisteredFlights uint {flight-name: (string-ascii 7), airline-id: uint }) 

;; init first airline on deployment
(map-set Airlines 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5
  { 
    airline-id: u1,
    airline-state: u2,
    airline-name: "First Airline",
    voters:  (list ),
  }
)
(map-set RegisteredAirlines u1 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
(var-set registeredAirlines u1)
(var-set idCounter u1)

;; private functions
;;

(define-private (register (airline principal) (id uint))
  (begin 
    (map-set RegisteredAirlines id airline)
    (var-set registeredAirlines (+ (var-get registeredAirlines) u1))
  )
)

(define-private (set-airline-state (airline principal) (state uint))
  (map-set Airlines airline (merge (unwrap-panic (map-get? Airlines airline)) {airline-state: state}))
)

;; public functions
;;

;; whitelisting
(define-read-only (is-whitelisted (app-contract principal))
	(default-to false (map-get? AuthorizedCallers app-contract))
)
;; (contract-call? .flight-surety-data is-whitelisted 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)

(define-public (set-whitelisted (appContract principal) (whitelisted bool))
	(begin
		(asserts! (is-eq CONTRACT_OWNER tx-sender) ERR_UNAUTHORISED)
    ;; #[filter(appContract, whitelisted)]
		(ok (map-set AuthorizedCallers appContract whitelisted))
	)
)
;; (contract-call? .flight-surety-data set-whitelisted 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM true)

;; airlines
(define-read-only (get-airlines-count) 
  (var-get registeredAirlines)
)
;; (contract-call? .flight-surety-data get-airlines-count)

(define-read-only (get-airline (airline principal)) 
  (map-get? Airlines airline)
)

(define-public (add-airline-data (airline principal) (airlineName (string-ascii 30)) (caller principal) (status uint)) 
  (let 
    (
      (airlineData (map-get? Airlines airline))
      (id (if (is-none airlineData) 
          (+ (var-get idCounter) u1) 
          (unwrap-panic (get airline-id airlineData))
      ))
      (voteList (if (is-none airlineData) 
          (list caller) 
          (append (unwrap-panic (get voters airlineData)) caller)
      ))
    )
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    ;; #[filter(airline, airlineName, caller, status)]
    (map-set Airlines airline {
      airline-id: id,
      airline-state: status,
      airline-name: airlineName,
      voters:  (unwrap-panic (as-max-len? voteList u25)),
    })

    (if (is-none airlineData) (var-set idCounter id) false)
    (if (is-eq status u2) (register airline id) false) 
    
    (ok {airline-id: id, airline-state: status, votes: (len voteList), reg-airlines: (var-get registeredAirlines) })
  )
)

;; assert airline is registered
(define-public (funded-airline-state (airline principal))
  (begin
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    ;; #[filter(airline)]
    (ok (set-airline-state airline u3))
  )
)

;;  flights
(define-read-only (get-flight (airline-id uint) (flight-id (string-ascii 7)))
  (map-get? Flights { flight-id: flight-id, airline-id: airline-id })
)

(define-public (register-flight (airline-id uint) (flight-id (string-ascii 7)) (activate bool) (payouts {status: (list 4 uint),payout: (list 4 uint) }) (max-payout uint))
  (begin
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED)
    ;; #[filter(flight-id, airline-id, activate, payouts,max-payout)]
    (map-set Flights { flight-id: flight-id, airline-id: airline-id } {
       active: activate,
       status-code: (get status payouts),
       payout: (get payout payouts),
       max-payout: max-payout,
    })
    (ok true)
  )
)
