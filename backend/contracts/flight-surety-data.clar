
;; flight-surety-data
;; <add a description here>


;; error consts   ;;;********* mainly handled by app, keep only data related no logic
;;
(define-constant ERR_UNAUTHORISED (err u2011))
(define-constant NOT_WHITELISTED (err u2012))

(define-constant AIRLINE_NOT_FOUND (err u2001))
(define-constant BAD_AIRLINE_STATUS (err u2002))
(define-constant AIRLINE_ALREADY_REGISTERED (err u2003))
(define-constant ONLY_BY_REGISTERED_AIRLINE (err u2004))
(define-constant AIRLINE_NOT_IN_APPLICATION (err u2005))
(define-constant AIRLINE_NAME_NOT_PROVIDED (err u2006))
(define-constant ALREADY_VOTED (err u2007))

;; constants
;;
(define-constant CONTRACT_OWNER tx-sender)
(define-constant CONTRACT_ADDRESS (as-contract tx-sender))
(define-constant AIRLINE_FUNDING u1000000)  ;; move to app --> logic
(define-constant AIRLINE_STATE ;; move to app --> logic
  (list "Init" "Application" "Registered" "Funded")
)

;; data maps and vars
;;
(define-data-var registeredAirlines uint u0) ;; Airlines registered
(define-data-var idCounter uint u0)  ;; Airlines ID counter

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

;; verify if funded state or something els should be added ----> has to be checked in tests, not done yet
(define-map RegisteredAirlines uint principal)   ;; < implement , could be useful .... done for airline deployment, contract logic tbd

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
;; (contract-call? .flight-surety-data get-airline 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
;;(define-read-only (get-airline-votes (airline principal))   ;;; move to logic derived out of get ariline
;;      (len (default-to (list ) (get voters (maauregisteredthp-get? Airlines airline))))
;;)

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
    (asserts! (is-whitelisted contract-caller) NOT_WHITELISTED) ;; contract-caller instead of tx-sender
    ;;(asserts! (has-airline-state caller u2) ONLY_BY_REGISTERED_AIRLINE)    ;;;; move asserts to app/logic
    ;;(asserts! (is-eq (has-airline-state airline u2) false) AIRLINE_ALREADY_REGISTERED)
    ;;(asserts! (is-none (index-of votersList caller)) ALREADY_VOTED)
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
(define-public (fund-airline (airline principal))
  (begin
    ;; (asserts! (has-airline-state airline u2) ONLY_BY_REGISTERED_AIRLINE)   ;;; move to app/logic
    ;; #[filter(airline)]
    (try! (stx-transfer? AIRLINE_FUNDING airline CONTRACT_ADDRESS) ) ;; assume to call transaction out of app contract !!!!!
    (ok (map-set Airlines airline (merge (unwrap-panic (map-get? Airlines airline)) {airline-state: u3})))
  )
)
;; (contract-call? .flight-surety-data fund-airline 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)
